# InterProt

This repo contains tools for interpreting protein language models using sparse autoencoders (SAEs). Our SAE visualizer is available at [interprot.com/](https://interprot.com/). For more information, check out our [preprint](TODO).

`viz` contains the frontend app for visualizing SAE features. `interprot` is a Python package for SAE training, evaluation, and interpretation.

## Getting started with our SAEs

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/etowahadams/interprot/blob/main/notebooks/sae_inference.ipynb)

Check out this demo notebook for running inference on our layer 24 SAE with a custom input sequence.

## The visualizer

The visualizer is a React app with some RunPod serverless functions as backend.

### Running the visualizer locally

```bash
cd viz
pnpm install
pnpm run dev
```

### RunPod endpoints

The RunPod serverless functions live in their own repos:

- SAE inference: https://github.com/liambai/sae-inference
- SAE steering: https://github.com/liambai/sae-steering
