/// <reference types="vite/client" />

interface ImportMetaEnv {
  // RunPod (Steering - not yet migrated to Modal)
  readonly VITE_RUNPOD_API_KEY: string;
  readonly VITE_SUGGEST_FEATURE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
