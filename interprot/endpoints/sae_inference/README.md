# SAE Inference Endpoint on RunPod

To publish a new version with tag e.g. `v1.2`, in this directory:

```
docker build -t liambai2/esm-sae-inference:<tag> --platform linux/amd64 .
docker push liambai2/esm-sae-inference:<tag>
```
