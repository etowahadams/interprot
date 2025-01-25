type RunpodSAEDimActivationsInput = {
  sae_name: string;
  sequence: string;
  dim: number;
};

type RunpodSAEAllDimsActivationsInput = {
  sae_name: string;
  sequence: string;
};

type RunpodSteeringInput = {
  sae_name: string;
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

// Maintain two caches:
// 1. model+dim+sequence -> activations
// 2. model+sequence -> all dims activations
const SAEDimActivationsCache: Record<string, number[]> = {};
const SAEAllDimsActivationsCache: Record<string, Array<{ dim: number; sae_acts: number[] }>> = {};

export async function getSAEDimActivations(input: RunpodSAEDimActivationsInput): Promise<number[]> {
  // First try the dim specific cache
  const dimCacheKey = `${input.sae_name}-${input.sequence}-${input.dim}`;
  if (dimCacheKey in SAEDimActivationsCache) {
    return SAEDimActivationsCache[dimCacheKey];
  }
  // It's possible that the all dims cache is populated for a previous search against all dims.
  // If so, we can retrieve the dim activations.
  const allDimsCacheKey = `${input.sae_name}-${input.sequence}`;
  if (allDimsCacheKey in SAEAllDimsActivationsCache) {
    const allDimsData = SAEAllDimsActivationsCache[allDimsCacheKey];
    const dimData = allDimsData.find((d) => d.dim === input.dim);
    if (dimData) {
      return dimData.sae_acts;
    }
  }

  // Both caches have missed, call API.
  const data = await postRunpod(input, "fad3whi01lfmh2");
  SAEDimActivationsCache[dimCacheKey] = data.tokens_acts_list;
  return data.tokens_acts_list;
}

export async function getSAEAllDimsActivations(
  input: RunpodSAEAllDimsActivationsInput
): Promise<Array<{ dim: number; sae_acts: number[] }>> {
  const cacheKey = `${input.sae_name}-${input.sequence}`;
  if (cacheKey in SAEAllDimsActivationsCache) {
    return SAEAllDimsActivationsCache[cacheKey];
  }
  const data = await postRunpod(input, "fad3whi01lfmh2");
  SAEAllDimsActivationsCache[cacheKey] = data.token_acts_list_by_active_dim;
  return data.token_acts_list_by_active_dim;
}

export async function getSteeredSequence(input: RunpodSteeringInput): Promise<string> {
  const data = await postRunpod(input, "ok5xk5v1375qpf");
  return data.steered_sequence;
}
