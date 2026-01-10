interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

interface SuggestFeatureRequest {
  model: string;
  dim: number;
  name: string;
  description: string;
  group: string;
  contributorName?: string;
  contributorLink?: string;
}

interface CuratedFeature {
  name: string;
  dim: number;
  desc: string;
  contributor?: string;
  group?: string;
}

interface CuratedFeaturesData {
  [model: string]: CuratedFeature[];
}

interface ContributorsData {
  [name: string]: string;
}

const CURATED_FEATURES_PATH = "viz/src/data/curated-features.json";
const CONTRIBUTORS_PATH = "viz/src/data/contributors.json";

async function githubRequest(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith("https://")
    ? endpoint
    : `https://api.github.com${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "InterProt-Suggest-Feature-Worker",
      ...options.headers,
    },
  });
}

async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
  ref = "main"
): Promise<{ content: string; sha: string }> {
  const response = await githubRequest(
    `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    token
  );

  if (!response.ok) {
    throw new Error(`Failed to get file ${path}: ${response.statusText}`);
  }

  const data = (await response.json()) as { content: string; sha: string };
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha };
}

async function getMainBranchSha(
  owner: string,
  repo: string,
  token: string
): Promise<string> {
  const response = await githubRequest(
    `/repos/${owner}/${repo}/git/ref/heads/main`,
    token
  );

  if (!response.ok) {
    throw new Error(`Failed to get main branch: ${response.statusText}`);
  }

  const data = (await response.json()) as { object: { sha: string } };
  return data.object.sha;
}

async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  sha: string,
  token: string
): Promise<void> {
  const response = await githubRequest(`/repos/${owner}/${repo}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create branch: ${error}`);
  }
}

async function updateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha: string,
  token: string
): Promise<void> {
  const response = await githubRequest(
    `/repos/${owner}/${repo}/contents/${path}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: btoa(content),
        sha,
        branch,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update file ${path}: ${error}`);
  }
}

async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
  token: string
): Promise<string> {
  const response = await githubRequest(`/repos/${owner}/${repo}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      head,
      base,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PR: ${error}`);
  }

  const data = (await response.json()) as { html_url: string };
  return data.html_url;
}

function validateRequest(data: unknown): SuggestFeatureRequest {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid request body");
  }

  const req = data as Record<string, unknown>;

  if (typeof req.model !== "string" || !req.model) {
    throw new Error("model is required");
  }
  if (typeof req.dim !== "number" || req.dim < 0) {
    throw new Error("dim must be a non-negative number");
  }
  if (typeof req.name !== "string" || !req.name || req.name.length > 50) {
    throw new Error("name is required and must be 50 characters or less");
  }
  if (
    typeof req.description !== "string" ||
    !req.description ||
    req.description.length > 2000
  ) {
    throw new Error("description is required and must be 2000 characters or less");
  }
  if (typeof req.group !== "string" || !req.group) {
    throw new Error("group is required");
  }
  if (req.contributorName !== undefined && typeof req.contributorName !== "string") {
    throw new Error("contributorName must be a string if provided");
  }
  if (req.contributorLink !== undefined && typeof req.contributorLink !== "string") {
    throw new Error("contributorLink must be a string if provided");
  }

  return {
    model: req.model,
    dim: req.dim,
    name: req.name,
    description: req.description,
    group: req.group,
    contributorName: (req.contributorName as string) || undefined,
    contributorLink: req.contributorLink as string | undefined,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      const body = await request.json();
      const data = validateRequest(body);

      const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = env;

      if (!GITHUB_TOKEN) {
        throw new Error("GitHub token not configured");
      }

      // Get current files from main branch
      const [curatedFeaturesFile, contributorsFile] = await Promise.all([
        getFileContent(GITHUB_OWNER, GITHUB_REPO, CURATED_FEATURES_PATH, GITHUB_TOKEN),
        getFileContent(GITHUB_OWNER, GITHUB_REPO, CONTRIBUTORS_PATH, GITHUB_TOKEN),
      ]);

      const curatedFeatures: CuratedFeaturesData = JSON.parse(curatedFeaturesFile.content);
      const contributors: ContributorsData = JSON.parse(contributorsFile.content);

      // Check if model exists
      if (!(data.model in curatedFeatures)) {
        return new Response(
          JSON.stringify({ error: `Unknown model: ${data.model}` }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Check for duplicate
      const existingFeature = curatedFeatures[data.model].find(
        (f) => f.dim === data.dim
      );
      if (existingFeature) {
        return new Response(
          JSON.stringify({
            error: `Feature ${data.dim} already exists in ${data.model} as "${existingFeature.name}"`,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Create new feature
      const newFeature: CuratedFeature = {
        name: data.name,
        dim: data.dim,
        desc: data.description,
        group: data.group,
      };

      // Only add contributor if provided (non-anonymous)
      if (data.contributorName) {
        newFeature.contributor = data.contributorName;
      }

      curatedFeatures[data.model].push(newFeature);

      // Update contributors if new (only if name and link provided)
      let contributorsUpdated = false;
      if (data.contributorName && data.contributorLink && !(data.contributorName in contributors)) {
        contributors[data.contributorName] = data.contributorLink;
        contributorsUpdated = true;
      }

      // Create branch
      const mainSha = await getMainBranchSha(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
      const branchName = `curated-feature-${data.model.toLowerCase()}-${data.dim}-${Date.now()}`;

      await createBranch(GITHUB_OWNER, GITHUB_REPO, branchName, mainSha, GITHUB_TOKEN);

      // Update curated features file
      await updateFile(
        GITHUB_OWNER,
        GITHUB_REPO,
        CURATED_FEATURES_PATH,
        JSON.stringify(curatedFeatures, null, 2),
        `Add curated feature: ${data.name} (${data.model} dim ${data.dim})`,
        branchName,
        curatedFeaturesFile.sha,
        GITHUB_TOKEN
      );

      // Update contributors file if needed
      if (contributorsUpdated) {
        // Need to get the new SHA after the first commit
        const updatedContributorsFile = await getFileContent(
          GITHUB_OWNER,
          GITHUB_REPO,
          CONTRIBUTORS_PATH,
          GITHUB_TOKEN,
          branchName
        );

        await updateFile(
          GITHUB_OWNER,
          GITHUB_REPO,
          CONTRIBUTORS_PATH,
          JSON.stringify(contributors, null, 2),
          `Add contributor: ${data.contributorName}`,
          branchName,
          updatedContributorsFile.sha,
          GITHUB_TOKEN
        );
      }

      // Create pull request
      const suggestedBy = data.contributorName
        ? `${data.contributorName}${data.contributorLink ? ` (${data.contributorLink})` : ""}`
        : "Anonymous";

      const prUrl = await createPullRequest(
        GITHUB_OWNER,
        GITHUB_REPO,
        `Add curated feature: ${data.name}`,
        `## New Curated Feature Suggestion

**Model:** ${data.model}
**Feature Dimension:** ${data.dim}
**Name:** ${data.name}
**Group:** ${data.group}
**Suggested by:** ${suggestedBy}

### Description
${data.description}

---
*This PR was automatically created via the InterProt feature suggestion form.*`,
        branchName,
        "main",
        GITHUB_TOKEN
      );

      return new Response(
        JSON.stringify({
          success: true,
          prUrl,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({
          success: false,
          error: message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
