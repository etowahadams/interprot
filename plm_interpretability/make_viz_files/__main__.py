import heapq
import json
import os
import re
from functools import lru_cache
from typing import Any

import click
import numpy as np
import polars as pl
import torch
from sae_model import SparseAutoencoder
from tqdm import tqdm
from transformers import AutoTokenizer, EsmModel
from utils import get_layer_activations

OUTPUT_ROOT_DIR = "viz_files"
NUM_SEQS_PER_DIM = 12


class TopKHeap:
    def __init__(self, k: int):
        self.k = k
        self.heap: list[tuple[float, int, Any]] = []

    def push(self, item: tuple[float, int, Any]):
        if len(self.heap) < self.k:
            heapq.heappush(self.heap, item)
        elif item > self.heap[0]:
            heapq.heapreplace(self.heap, item)

    def get_items(self) -> list[tuple[float, int, Any]]:
        return sorted(self.heap, reverse=True)


@lru_cache(maxsize=100000)
def get_sae_acts(
    seq: str,
    tokenizer: AutoTokenizer,
    plm_model: EsmModel,
    sae_model: SparseAutoencoder,
    plm_layer: int,
) -> np.ndarray[np.float32, np.float32]:
    """
    Returns a (len(seq), sae_dim) array of SAE activations.
    """
    esm_layer_acts = get_layer_activations(
        tokenizer=tokenizer, plm=plm_model, seqs=[seq], layer=plm_layer
    )[0]
    sae_acts = sae_model.get_acts(esm_layer_acts)[1:-1]  # Trim BOS and EOS tokens
    return sae_acts.cpu().numpy()


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
            raise ValueError("Checkpoint file must be named in the format plm<n>_l<n>_sae<n>")

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        tokenizer = AutoTokenizer.from_pretrained("facebook/esm2_t33_650M_UR50D")
        plm_model = EsmModel.from_pretrained("facebook/esm2_t33_650M_UR50D").to(device).eval()
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

        # Build a heap for each hidden dimension to store the top NUM_SEQS_PER_DIM sequences
        hidden_dim_to_seqs = {dim: TopKHeap(k=NUM_SEQS_PER_DIM) for dim in range(sae_dim)}

        df = pl.read_parquet(sequences_file)
        for seq_idx, row in tqdm(
            enumerate(df.iter_rows(named=True)), total=len(df), desc="Processing sequences"
        ):
            seq = row["Sequence"]
            sae_acts = get_sae_acts(seq, tokenizer, plm_model, sae_model, plm_layer)
            for dim in range(sae_dim):
                sae_dim_acts = sae_acts[:, dim]
                # Use the max activation across the sequence for ranking
                max_act = np.max(sae_dim_acts)
                if max_act > 0:
                    hidden_dim_to_seqs[dim].push((max_act, seq_idx, sae_dim_acts))

        dim_to_examples = {}
        for dim in range(sae_dim):
            examples = [
                {
                    "tokens_acts_list": [round(float(act), 1) for act in sae_dim_acts],
                    "tokens_list": tokenizer(df[seq_idx]["Sequence"].item())["input_ids"][1:-1],
                    "alphafold_id": df[seq_idx]["AlphaFoldDB"].item()[:-1],
                }
                for _, seq_idx, sae_dim_acts in hidden_dim_to_seqs[dim].get_items()
            ]
            dim_to_examples[dim] = examples

        output_dir_name = os.path.basename(checkpoint_file).split(".")[0]
        os.makedirs(os.path.join(OUTPUT_ROOT_DIR, output_dir_name), exist_ok=True)

        for dim in range(sae_dim):
            with open(os.path.join(OUTPUT_ROOT_DIR, output_dir_name, f"{dim}.json"), "w") as f:
                json.dump(dim_to_examples[dim], f)


if __name__ == "__main__":
    make_viz_files()
