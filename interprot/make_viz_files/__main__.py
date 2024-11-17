import heapq
import json
import os
import re
from typing import Any

import click
import numpy as np
import polars as pl
import torch
from tqdm import tqdm
from transformers import AutoTokenizer, EsmModel

from interprot.sae_model import SparseAutoencoder
from interprot.utils import get_layer_activations

OUTPUT_ROOT_DIR = "viz_files"
NUM_SEQS_PER_DIM = 12


def get_esm_layer_acts(
    seq: str, tokenizer: AutoTokenizer, plm_model: EsmModel, plm_layer: int
) -> torch.Tensor:
    acts = get_layer_activations(
        tokenizer=tokenizer, plm=plm_model, seqs=[seq], layer=plm_layer
    )[0]
    return acts


@click.command()
@click.option(
    "--checkpoint-files",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    required=True,
    multiple=True,
    help="Paths to the SAE checkpoint files",
)
@click.option(
    "--sequences-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    required=True,
    help="Path to the sequences file containing AlphaFoldDB IDs",
)
def make_viz_files(checkpoint_files: list[str], sequences_file: str):
    """
    Generate visualization files for SAE latents for multiple checkpoint files.
    """
    os.makedirs(OUTPUT_ROOT_DIR, exist_ok=True)

    for checkpoint_file in checkpoint_files:
        click.echo(f"Generating visualization files for {checkpoint_file}")

        pattern = r"plm(\d+).*?l(\d+).*?sae(\d+)"
        matches = re.search(pattern, checkpoint_file)

        if matches:
            plm_dim, plm_layer, sae_dim = map(int, matches.groups())
        else:
            raise ValueError(
                "Checkpoint file must be named in the format plm<n>_l<n>_sae<n>"
            )

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        tokenizer = AutoTokenizer.from_pretrained("facebook/esm2_t33_650M_UR50D")
        plm_model = (
            EsmModel.from_pretrained("facebook/esm2_t33_650M_UR50D").to(device).eval()
        )
        sae_model = SparseAutoencoder(plm_dim, sae_dim).to(device)

        try:
            sae_model.load_state_dict(torch.load(checkpoint_file, map_location=device))
        except Exception:
            sae_model.load_state_dict(
                {
                    k.replace("sae_model.", ""): v
                    for k, v in torch.load(checkpoint_file, map_location=device)[
                        "state_dict"
                    ].items()
                }
            )

        df = pl.read_parquet(sequences_file)
        has_interpro = "InterPro" in df.columns
        if has_interpro:
            df = df.with_columns(
                pl.col("InterPro").str.split(";").alias("interpro_ids")
            )

        # Pre-allocate numpy array for storing max activations
        all_seqs_max_act = np.zeros((sae_dim, len(df)))
        all_acts = [0 for _ in range(len(df))]

        for seq_idx, row in tqdm(
            enumerate(df.iter_rows(named=True)),
            total=len(df),
            desc="Running inference over all seqs (Step 1/3)",
        ):
            seq = row["Sequence"]
            # Get ESM activations and immediately detach from computation graph
            esm_layer_acts = get_esm_layer_acts(seq, tokenizer, plm_model, plm_layer)

            # Process activations in chunks if sequence is too long
            sae_acts = sae_model.get_acts(esm_layer_acts)[1:-1]

            # Move to CPU and convert to numpy immediately
            sae_acts_cpu = sae_acts.cpu().numpy()
            all_seqs_max_act[:, seq_idx] = np.max(sae_acts_cpu, axis=0)
            sae_acts_int = (sae_acts_cpu * 10).astype(np.int8)
            all_acts[seq_idx] = sae_acts_int
            # Clear CUDA cache periodically
            if seq_idx % 100 == 0:
                torch.cuda.empty_cache()

        # Save intermediate results
        with open(os.path.join(OUTPUT_ROOT_DIR, "all_seqs_max_act.npy"), "wb") as f:
            np.save(f, all_seqs_max_act)

        hidden_dim_to_seqs = {dim: {} for dim in range(sae_dim)}

        # Calculate the top sequences for each hidden dimension and quartile
        quartile_names = ["Q1", "Q2", "Q3", "Q4"]
        for dim in tqdm(
            range(sae_dim), desc="Finding highest activating seqs (Step 2/3)"
        ):
            dim_maxes = all_seqs_max_act[dim]
            if np.all(dim_maxes == 0):
                continue
            non_zero_maxes = dim_maxes[dim_maxes > 0]
            hidden_dim_to_seqs[dim]["freq_activate_among_all_seqs"] = len(
                non_zero_maxes
            ) / len(dim_maxes)
            quartiles = np.percentile(non_zero_maxes, [25, 50, 75])

            q1_mask = (dim_maxes > 0) & (dim_maxes <= quartiles[0])
            q2_mask = (dim_maxes > quartiles[0]) & (dim_maxes <= quartiles[1])
            q3_mask = (dim_maxes > quartiles[1]) & (dim_maxes <= quartiles[2])
            q4_mask = dim_maxes > quartiles[2]

            quartile_indices = [
                np.where(mask)[0] for mask in [q1_mask, q2_mask, q3_mask, q4_mask]
            ]
            for q_name, q_indices in zip(quartile_names, quartile_indices):
                top_indices = heapq.nlargest(
                    NUM_SEQS_PER_DIM, q_indices, key=lambda i: dim_maxes[i]
                )
                hidden_dim_to_seqs[dim][q_name] = {}
                hidden_dim_to_seqs[dim][q_name]["n_seqs"] = len(q_indices)
                hidden_dim_to_seqs[dim][q_name]["indices"] = top_indices
                if has_interpro:
                    hidden_dim_to_seqs[dim][q_name]["interpro"] = get_top_interpro(
                        df, q_indices, top_n=10
                    )

        for dim in tqdm(range(sae_dim), desc="Writing visualization files (Step 3/3)"):
            viz_file = {"quartiles": {}}
            if "freq_activate_among_all_seqs" in hidden_dim_to_seqs[dim]:
                viz_file["freq_activate_among_all_seqs"] = hidden_dim_to_seqs[dim][
                    "freq_activate_among_all_seqs"
                ]
            for quartile in quartile_names:
                if quartile not in hidden_dim_to_seqs[dim]:
                    continue
                quartile_examples = {
                    "examples": [],
                    "n_seqs": hidden_dim_to_seqs[dim][quartile]["n_seqs"],
                }
                if has_interpro:
                    quartile_examples["interpro"] = hidden_dim_to_seqs[dim][quartile][
                        "interpro"
                    ]
                quartile_indices = hidden_dim_to_seqs[dim][quartile]["indices"]

                for seq_idx in quartile_indices:
                    seq_idx = int(seq_idx)
                    sae_acts = all_acts[seq_idx]
                    dim_acts = sae_acts[:, dim]
                    uniprot_id = df[seq_idx]["Entry"].item()[:-1]
                    alphafolddb_id = df[seq_idx]["AlphaFoldDB"].item().split(";")[0]
                    protein_name = df[seq_idx]["Protein names"].item()

                    examples = {
                        "sae_acts": [round(float(act) / 10, 1) for act in dim_acts],
                        "sequence": seq,
                        "alphafold_id": alphafolddb_id,
                        "uniprot_id": uniprot_id,
                        "name": protein_name,
                    }
                    quartile_examples["examples"].append(examples)

                viz_file["quartiles"][quartile] = quartile_examples

            with open(os.path.join(OUTPUT_ROOT_DIR, f"{dim}.json"), "w") as f:
                json.dump(viz_file, f)


def get_top_interpro(original_df, indices, top_n=5):
    df = original_df[indices]
    total_rows = len(df)
    counts = (
        df.explode("interpro_ids")["interpro_ids"]
        .drop_nulls()
        .value_counts()
        .sort("count", descending=True)
        .filter(pl.col("interpro_ids") != "")[:top_n]
    )
    freq_table = counts.with_columns(pl.col("count") / total_rows).rename(
        {"count": "freq"}
    )
    freq_dict = freq_table.to_dict()
    return {key: value.to_list() for key, value in freq_dict.items()}


if __name__ == "__main__":
    make_viz_files()
