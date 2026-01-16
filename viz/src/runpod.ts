// Modal SAE Inference API
// Note: File kept as runpod.ts to minimize import changes - consider renaming to modal.ts

const MODAL_INFERENCE_ENDPOINT = "https://liambai--sae-inference-saeinference-inference.modal.run";
const STEERING_ENDPOINT_ID = "8ee0uonshst9k2"; // Still on RunPod

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

async function postModal(input: SAEDimActivationsInput | SAEAllDimsActivationsInput) {
  try {
    const response = await fetch(MODAL_INFERENCE_ENDPOINT, {
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

// Keep RunPod for steering endpoint (not yet migrated)
async function postRunpod(input: SteeringInput, endpointId: string) {
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
  const data = await postModal(input);
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
  const data = await postModal(input);
  SAEAllDimsActivationsCache[cacheKey] = data.token_acts_list_by_active_dim;
  return data.token_acts_list_by_active_dim;
}

// Steering still uses RunPod (not yet migrated to Modal)
export async function getSteeredSequence(input: SteeringInput): Promise<string> {
  const data = await postRunpod(input, STEERING_ENDPOINT_ID);
  return data.steered_sequence;
}
