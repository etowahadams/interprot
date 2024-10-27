import heapq
import json
import os
import re
from functools import lru_cache
from typing import Any
import numpy as np
from typing import List, Dict, Tuple

import click
import numpy as np
import polars as pl
import torch
from tqdm import tqdm
from transformers import AutoTokenizer, EsmModel

from plm_interpretability.sae_model import SparseAutoencoder
from plm_interpretability.utils import get_layer_activations

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
def get_esm_layer_acts(
    seq: str, tokenizer: AutoTokenizer, plm_model: EsmModel, plm_layer: int
) -> torch.Tensor:
    return get_layer_activations(tokenizer=tokenizer, plm=plm_model, seqs=[seq], layer=plm_layer)[0]


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
            esm_layer_acts = get_esm_layer_acts(seq, tokenizer, plm_model, plm_layer)
            sae_acts = (
                sae_model.get_acts(esm_layer_acts)[1:-1].cpu().numpy()
            )  # Trim BOS and EOS tokens
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
def make_viz_files_quartile(checkpoint_files: list[str], sequences_file: str):
    """
    Generate visualization files for SAE latents for multiple checkpoint files,
    analyzing sequences by quartiles for each dimension.
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
        
        # Process all sequences first to build the complete activation matrix
        all_sequences = []
        sequence_ids = []
        sequence_info = []  # Store additional sequence information
        
        for seq_idx, row in tqdm(
            enumerate(df.iter_rows(named=True)),
            total=len(df),
            desc="Processing sequences",
        ):
            seq = row["Sequence"]
            esm_layer_acts = get_esm_layer_acts(seq, tokenizer, plm_model, plm_layer)
            sae_acts = (
                sae_model.get_acts(esm_layer_acts)[1:-1].cpu().numpy()
            )  # Trim BOS and EOS tokens
            all_sequences.append(sae_acts)
            sequence_ids.append(str(seq_idx))
            sequence_info.append({
                "name": row["Protein names"],
                "tokens_list": tokenizer(seq)["input_ids"][1:-1],
                "alphafold_id": row["AlphaFoldDB"][:-1],
                "sequence": seq
            })

        # Analyze each dimension
        dim_to_examples = {}
        for dim in tqdm(range(sae_dim), desc="Analyzing dimensions"):
            # Get quartile analysis for this dimension
            results = analyze_sequences_by_column(
                sequences=all_sequences,
                sequence_ids=sequence_ids,
                column_idx=dim,
                top_k=NUM_SEQS_PER_DIM
            )
            
            # Format examples for each quartile
            examples = []
            for quartile, top_sequences in results.items():
                current_quartile = {
                    'quartile': quartile,
                    'examples': []
                }
                for seq_id, max_act in top_sequences:
                    if max_act == 0:
                        continue
                    seq_idx = int(seq_id)
                    seq_acts = all_sequences[seq_idx][:, dim]
                    
                    example = {
                        "tokens_acts_list": [round(float(act), 1) for act in seq_acts],
                        "tokens_list": sequence_info[seq_idx]["tokens_list"],
                        "alphafold_id": sequence_info[seq_idx]["alphafold_id"],
                        "name": sequence_info[seq_idx]["name"],
                    }
                    current_quartile['examples'].append(example)
                examples.append(current_quartile)
            dim_to_examples[dim] = examples

        # Save results
        output_dir_name = os.path.basename(checkpoint_file).split(".")[0]
        os.makedirs(os.path.join(OUTPUT_ROOT_DIR, output_dir_name), exist_ok=True)

        for dim in tqdm(range(sae_dim), desc="Saving results"):
            quartiles = dim_to_examples[dim]
            has_examples = any([len(quartile['examples']) > 0 for quartile in quartiles])
            if not has_examples:
                continue

            with open(
                os.path.join(OUTPUT_ROOT_DIR, output_dir_name, f"{dim}.json"), "w"
            ) as f:
                json.dump(quartiles, f)
                # f.write(custom_json_dumps(quartiles, indent=2))


def custom_json_dumps(data, indent=None):
    """
    Custom JSON dumps function that puts all arrays on the same line,
    but properly indents objects within arrays.
    """
    def _serialize(obj, level=0):
        if isinstance(obj, dict):
            items = []
            for key, value in obj.items():
                items.append(f'{" " * (level * indent)}"{key}": {_serialize(value, level + 1)}')
            return "{\n" + ",\n".join(items) + f'\n{" " * ((level - 1) * indent)}}}'
        elif isinstance(obj, list):
            if all(isinstance(item, (str, int, float, bool, type(None))) for item in obj):
                items = [json.dumps(item) for item in obj]
                return "[" + ", ".join(items) + "]"
            else:
                items = [f'\n{" " * (level * indent)}{_serialize(item, level + 1)}' for item in obj]
                return "[" + ",".join(items) + f'\n{" " * ((level - 1) * indent)}]'
        else:
            return json.dumps(obj)

    return _serialize(data, 1)

def analyze_sequences_by_column(
    sequences: List[np.ndarray],
    sequence_ids: List[str],
    column_idx: int,
    top_k: int = 10
) -> Dict[str, List[Tuple[str, float]]]:
    """
    Analyze sequences to find top performers in each quartile for a specific column.
    
    Args:
        sequences: List of L x D numpy arrays, where L is sequence length
        sequence_ids: List of identifiers for each sequence
        column_idx: Index of the column to analyze
        top_k: Number of top sequences to return per quartile
        
    Returns:
        Dictionary with quartile labels and their top sequences with values
    """
    # Extract the maximum value for the specified column from each sequence
    max_values = np.array([seq[:, column_idx].max() for seq in sequences])
    
    # Calculate quartiles
    q1, q2, q3 = np.percentile(max_values, [25, 50, 75])
    # Create masks for each quartile
    q1_mask = max_values <= q1
    q2_mask = (max_values > q1) & (max_values <= q2)
    q3_mask = (max_values > q2) & (max_values <= q3)
    q4_mask = max_values > q3
    
    # Function to get top k sequences for a given mask
    def get_top_k_for_mask(mask: np.ndarray) -> List[Tuple[str, float]]:
        masked_values = max_values[mask]
        masked_ids = np.array(sequence_ids)[mask]
        
        # Sort and get top k indices
        top_indices = np.argsort(masked_values)[-top_k:][::-1]
        
        return [(masked_ids[i], masked_values[i]) for i in top_indices]
    
    # Get results for each quartile
    quartile_results = {
        'fourth': get_top_k_for_mask(q4_mask),
        'third': get_top_k_for_mask(q3_mask),
        'second': get_top_k_for_mask(q2_mask),
        'first': get_top_k_for_mask(q1_mask)
    }
    
    return quartile_results

if __name__ == "__main__":
    make_viz_files_quartile()
