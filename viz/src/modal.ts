// Modal SAE API

const MODAL_INFERENCE_ENDPOINT = "https://liambai--sae-inference-saeinference-inference.modal.run";
const MODAL_STEERING_ENDPOINT = "https://liambai--sae-steering-saesteering-steering.modal.run";

type SAEDimActivationsInput = {
  sae_name: string;
  sequence: string;
  dim: number;
};

type SAEAllDimsActivationsInput = {
  sae_name: string;
  sequence: string;
};

type SteeringInput = {
  sae_name: string;
  sequence: string;
  dim: number;
  multiplier: number;
};

async function postModal(
  endpoint: string,
  input: SAEDimActivationsInput | SAEAllDimsActivationsInput | SteeringInput
) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Network error! Status: ${response.status}`);
    }

    const resp = await response.json();
    if (resp.status !== "success" || !resp.data) {
      throw new Error(resp.error || "Invalid response format from Modal API");
    }

    return resp.data;
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

export async function getSAEDimActivations(input: SAEDimActivationsInput): Promise<number[]> {
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

  // Both caches have missed, call Modal API
  const data = await postModal(MODAL_INFERENCE_ENDPOINT, input);
  SAEDimActivationsCache[dimCacheKey] = data.tokens_acts_list;
  return data.tokens_acts_list;
}

export async function getSAEAllDimsActivations(
  input: SAEAllDimsActivationsInput
): Promise<Array<{ dim: number; sae_acts: number[] }>> {
  const cacheKey = `${input.sae_name}-${input.sequence}`;
  if (cacheKey in SAEAllDimsActivationsCache) {
    return SAEAllDimsActivationsCache[cacheKey];
  }
  const data = await postModal(MODAL_INFERENCE_ENDPOINT, input);
  SAEAllDimsActivationsCache[cacheKey] = data.token_acts_list_by_active_dim;
  return data.token_acts_list_by_active_dim;
}

export async function getSteeredSequence(input: SteeringInput): Promise<string> {
  const data = await postModal(MODAL_STEERING_ENDPOINT, input);
  return data.steered_sequence;
}
