# Feature Steering Endpoint on RunPod

To publish a new version with tag e.g. `v1.2`, in this directory:

```
docker build -t liambai2/sae-feature-steering:<tag> --platform linux/amd64 .
docker push liambai2/sae-feature-steering:<tag>
```
