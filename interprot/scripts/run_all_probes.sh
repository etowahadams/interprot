#!/bin/bash

# Check if all required arguments are provided
if [ $# -lt 3 ]; then
    echo "Error: Insufficient arguments provided."
    echo "Usage: $0 <path_to_checkpoint_file> <sae_dim> <plm_layer>"
    exit 1
fi

# Assign arguments to variables
checkpoint_file="$1"
sae_dim="$2"
plm_layer="$3"

echo "Checkpoint file: $checkpoint_file"
echo "SAE dimension: $sae_dim"
echo "PLM layer: $plm_layer"


# Check if swissprot_full_annotations.tsv exists. If not, download it.
if [ ! -f "swissprot_full_annotations.tsv" ]; then
    echo "swissprot_full_annotations.tsv not found. Downloading..."
    gdown https://drive.google.com/uc?id=1TmbZGKt81Php8NT4s4OfbIwh05h-GJDS
    echo "Download complete."
else
    echo "swissprot_full_annotations.tsv already exists. Skipping download."
fi


# Extract the base name of the checkpoint file
checkpoint_file=$(basename "$1")

# Remove the file extension
checkpoint_name="${checkpoint_file%.*}"

# Create the output directory
output_dir="${checkpoint_name}_probe_results"
mkdir -p "$output_dir"

# Run the logistic regression probes
oned_probe single-latent \
    --sae-checkpoint $checkpoint_file \
    --sae-dim $sae_dim \
    --plm-dim 1280 \
    --plm-layer $plm_layer \
    --swissprot-tsv swissprot_full_annotations.tsv \
    --output-dir $output_dir/single_latent_single_residue

oned_probe single-latent \
    --sae-checkpoint $checkpoint_file \
    --sae-dim $sae_dim \
    --plm-dim 1280 \
    --plm-layer $plm_layer \
    --swissprot-tsv swissprot_full_annotations.tsv \
    --pool-over-annotation True \
    --output-dir $output_dir/single_latent_pool_over_annotation

oned_probe all-latents \
    --sae-checkpoint $checkpoint_file \
    --sae-dim $sae_dim \
    --plm-dim 1280 \
    --plm-layer $plm_layer \
    --swissprot-tsv swissprot_full_annotations.tsv \
    --output-file $output_dir/all_latents.csv

echo "Finished running all probes. Results saved in $output_dir"
