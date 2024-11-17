type RunpodSAEDimActivationsInput = {
  sequence: string;
  dim: number;
};

type RunpodSAEAllDimsActivationsInput = {
  sequence: string;
};

type RunpodSteeringInput = {
  sequence: string;
  dim: number;
  multiplier: number;
};

export async function postRunpod(
  input: RunpodSAEDimActivationsInput | RunpodSAEAllDimsActivationsInput | RunpodSteeringInput,
  endpointId: string
) {
  try {
    const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: input,
      }),
    });

    if (!response.ok) {
      throw new Error(`Network error! Status: ${response.status}`);
    }

    const resp = await response.json();
    if (!resp.output?.data) {
      throw new Error("Invalid response format from RunPod API");
    }

    return resp.output.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

// Cache for sequence+dim -> activations
const SAEDimActivationsCache: Record<string, number[]> = {};

export async function getSAEDimActivations(input: RunpodSAEDimActivationsInput): Promise<number[]> {
  const cacheKey = `${input.sequence}-${input.dim}`;
  if (cacheKey in SAEDimActivationsCache) {
    return SAEDimActivationsCache[cacheKey];
  }
  const data = await postRunpod(input, "yk9ehzl3h653vj");
  SAEDimActivationsCache[cacheKey] = data.tokens_acts_list;
  return data.tokens_acts_list;
}

export async function getSAEAllDimsActivations(
  input: RunpodSAEAllDimsActivationsInput
): Promise<Array<{ dim: number; sae_acts: number[] }>> {
  const data = await postRunpod(input, "yk9ehzl3h653vj");
  for (const { dim, sae_acts } of data.token_acts_list_by_active_dim) {
    SAEDimActivationsCache[`${input.sequence}-${dim}`] = sae_acts;
  }
  return data.token_acts_list_by_active_dim;
}

export async function getSteeredSequence(input: RunpodSteeringInput): Promise<string> {
  const data = await postRunpod(input, "jw4etc8vzvp99p");
  return data.steered_sequence;
}
