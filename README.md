# InterProt

This repo contains tools for interpreting protein language models using sparse autoencoders (SAEs). Our SAE visualizer is available at [interprot.com/](https://interprot.com/). For more information, check out our [preprint](TODO).

`viz` contains the frontend app for visualizing SAE features. `interprot` is a Python package for SAE training, evaluation, and interpretation.

## Running the visualizer locally

```bash
cd viz
pnpm install
pnpm run dev
```

## Getting started with our SAEs

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/etowahadams/interprot/blob/main/notebooks/sae_inference.ipynb)

Check out this demo notebook for running inference on our layer 24 SAE with a custom input sequence.
