# InterProt

This repo contains tools for interpreting protein language models using sparse autoencoders (SAEs). Our SAE visualizer is available at [interprot.com](https://interprot.com) and our SAE models weights are on [HuggingFace](https://huggingface.co/liambai/InterProt-ESM2-SAEs). For more information, check out our [preprint](https://www.biorxiv.org/content/10.1101/2025.02.06.636901v1).

`viz` contains the frontend app for visualizing SAE features. `interprot` is a Python package for SAE training, evaluation, and interpretation.

## Getting started with our SAEs

Check out this [demo notebook](./notebooks/sae_inference.ipynb) for SAE inference with a custom input sequence.

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/etowahadams/interprot/blob/main/notebooks/sae_inference.ipynb)

## The visualizer

The visualizer is a React app with some RunPod serverless functions that serve our SAEs.

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

## Generating visualization files

The visualizer and several of our analysis scripts require the generation of files (also referred to as visualization files) which summarize each SAE latent. 

1. Generate the visualization files using `interprot/make_viz_files/__main__.py`
2. Compute family specificity using `interprot/scripts/run_compute_family_specificity.py`
2. Classify latents by activation pattern using `interprot/scripts/run_viz_file_analysis.py`. This will also
compute many more statistics about the latents.

The input sequences to the visualization file generation script can be found [here](https://drive.google.com/file/d/1JwVzxDAlgWNe0qoTKbUozvqBxwcmMebB/view?usp=sharing).


## Running and developing the Python package

### Setting up pre-commit

```bash
pip install pre-commit
pre-commit install
```

### Building and running the Docker container

```bash
docker compose build
docker compose run --rm interprot bash
```

## Linear probes

We find linear probes over SAE latents to be a powerful tool for uncovering interpretable features. Here's a [demo notebook](./notebooks/subcellular_localization_linear_probe.ipynb) on the subcellular localization classification task.

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/etowahadams/interprot/blob/main/notebooks/subcellular_localization_linear_probe.ipynb)
