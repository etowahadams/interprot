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
from scipy import sparse

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
        has_pfam = "Pfam" in df.columns

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
            sae_acts_int = (sae_acts_cpu * 10).astype(np.uint8)
            # Convert to sparse matrix. This significantly reduces memory usage
            sparse_acts = sparse.csr_matrix(sae_acts_int)
            all_acts[seq_idx] = sparse_acts
            # Clear CUDA cache periodically
            if seq_idx % 100 == 0:
                torch.cuda.empty_cache()

        # Save intermediate results
        with open(os.path.join(OUTPUT_ROOT_DIR, "all_seqs_max_act.npy"), "wb") as f:
            np.save(f, all_seqs_max_act)

        hidden_dim_to_seqs = {dim: {} for dim in range(sae_dim)}

        act_ranges = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]]
        range_names = [f"{start}-{end}" for start, end in act_ranges]

        for dim in tqdm(
            range(sae_dim), desc="Finding highest activating seqs (Step 2/3)"
        ):
            dim_maxes = all_seqs_max_act[dim]
            non_zero_maxes = dim_maxes[dim_maxes > 0]

            if len(non_zero_maxes) == 0:
                print(f"Skipping dimension {dim} as it has no activations")
                continue

            # Get top Pfam families for sequences with activations greater than 0.75
            if has_pfam:
                top_families = get_top_pfam(
                    df, dim_maxes, act_gt=0.75, n_classes=3, frac_above_threshold=0.8
                )
                hidden_dim_to_seqs[dim]["top_pfam"] = top_families

            non_zero_maxes = dim_maxes[dim_maxes > 0]
            hidden_dim_to_seqs[dim]["freq_active"] = len(non_zero_maxes) / len(
                dim_maxes
            )
            hidden_dim_to_seqs[dim]["n_seqs"] = len(non_zero_maxes)
            hidden_dim_to_seqs[dim]["max_act"] = float(dim_maxes.max())

            normalized_acts = dim_maxes / dim_maxes.max()
            for i, (start, end) in enumerate(act_ranges):
                mask = (normalized_acts > start) & (normalized_acts <= end)
                top_indices = heapq.nlargest(
                    NUM_SEQS_PER_DIM, np.where(mask)[0], key=lambda i: dim_maxes[i]
                )
                range_name = range_names[i]
                hidden_dim_to_seqs[dim][range_name] = {}
                hidden_dim_to_seqs[dim][range_name]["indices"] = top_indices

        for dim in tqdm(range(sae_dim), desc="Writing visualization files (Step 3/3)"):
            if not hidden_dim_to_seqs[dim]:
                print(f"Skipping dimension {dim} as it has no sequences")
                continue
            write_viz_file(hidden_dim_to_seqs[dim], dim, all_acts, df, range_names)
            

def write_viz_file(dim_info, dim, all_acts, df, range_names):
    viz_file = {"ranges": {}}
    # Write how common the dimension is
    if "freq_active" in dim_info:
        viz_file["freq_active"] = dim_info["freq_active"]
    if "n_seqs" in dim_info:
        viz_file["n_seqs"] = dim_info["n_seqs"]
    if "top_pfam" in dim_info:
        viz_file["top_pfam"] = dim_info["top_pfam"]
    if "max_act" in dim_info:
        viz_file["max_act"] = dim_info["max_act"]

    for range_name in range_names:
        if range_name not in dim_info:
            continue
        range_examples = {
            "examples": [],
        }
        top_indices = dim_info[range_name]["indices"]

        for seq_idx in top_indices:
            seq_idx = int(seq_idx)
            sae_acts = all_acts[seq_idx].toarray()
            dim_acts = sae_acts[:, dim]
            uniprot_id = df[seq_idx]["Entry"].item()
            alphafolddb_id = df[seq_idx]["AlphaFoldDB"].item().split(";")[0]
            protein_name = df[seq_idx]["Protein names"].item()
            sequence = df[seq_idx]["Sequence"].item()

            examples = {
                "sae_acts": [round(float(act) / 10, 1) for act in dim_acts],
                "sequence": sequence,
                "alphafold_id": alphafolddb_id,
                "uniprot_id": uniprot_id,
                "name": protein_name,
            }
            range_examples["examples"].append(examples)

        viz_file["ranges"][range_name] = range_examples

    with open(os.path.join(OUTPUT_ROOT_DIR, f"{dim}.json"), "w") as f:
        json.dump(viz_file, f)



def get_top_pfam(df, dim_maxes, act_gt=0.75, n_classes=3, frac_above_threshold=0.8):
    """
    Gets the top Pfam families of sequences with activations greater than a threshold.
    For all sequences with activations greater than the threshold, it will return the top
    n_classes Pfam families if they account for at least frac_above_threshold of the sequences.

    Args:
        df: DataFrame containing the sequences
        dim_maxes: Numpy array of max activations for each sequence
        act_gt: Threshold for activations
        n_classes: Number of top Pfam families to return
        frac_above_threshold: Fraction of sequences that must be accounted for by the top n_classes Pfam families

    Returns:
        List of top Pfam families

    """
    normalized_acts = dim_maxes / dim_maxes.max()
    df_dim = df.with_columns(pl.Series(normalized_acts).alias("act"))
    non_zero = df_dim.filter(pl.col("act") > 0)
    if len(non_zero) < 10:
        return []

    gt_50 = non_zero.filter(pl.col("act") > act_gt)
    gt_50 = gt_50.with_columns(
        pl.col("Pfam").str.strip_chars(";").str.split(";").alias("pfam_list")
    )
    exploded = gt_50.explode("pfam_list")
    count_table = (
        exploded["pfam_list"].value_counts().drop_nulls().sort("count", descending=True)
    )
    count_order = {value: i for i, value in enumerate(count_table["pfam_list"])}
    exploded = (
        exploded.with_columns(
            pl.col("pfam_list").replace_strict(count_order).alias("pfam_ordered")
        )
        .sort("pfam_ordered")
        .drop_nulls()
    )
    cleaned_df = exploded.unique(subset=["Entry"], maintain_order=True)
    cleaned_df = cleaned_df.rename({"pfam_list": "pfam_common"})
    keep = (
        cleaned_df["pfam_common"]
        .value_counts()
        .drop_nulls()
        .sort("count", descending=True)
    )

    if len(keep) >= 1:
        top_count = sum(keep["count"][:n_classes])
        if top_count > (len(gt_50) * frac_above_threshold):
            return keep["pfam_common"][:n_classes].to_list()

    return []


if __name__ == "__main__":
    make_viz_files()
