import gc
import os
import random
import subprocess
import tempfile
from collections import defaultdict
from dataclasses import dataclass

import numpy as np
import pandas as pd
from tqdm import tqdm
from transformers import AutoTokenizer, EsmModel

from interprot.oned_probe.annotations import ResidueAnnotation
from interprot.oned_probe.logging import logger
from interprot.sae_model import SparseAutoencoder
from interprot.utils import get_layer_activations, parse_swissprot_annotation

MAX_SEQ_LEN = 1000


@dataclass
class Example:
    sae_acts: np.ndarray[float]
    target: bool

    def __eq__(self, other):
        if not isinstance(other, Example):
            return NotImplemented
        return np.array_equal(self.sae_acts, other.sae_acts) and self.target == other.target


def write_fasta(sequences: list[str], filename: str):
    with open(filename, "w") as f:
        for i, seq in enumerate(sequences):
            f.write(f">seq_{i}\n{seq}\n")


def parse_mmseqs2_clusters(cluster_file: str) -> dict[str, list[str]]:
    clusters = defaultdict(list)
    with open(cluster_file, "r") as f:
        for line in f:
            rep, member = line.strip().split("\t")
            clusters[rep].append(member)
    return clusters


def split_clusters(clusters: dict[str, list[str]], test_ratio: float = 0.1):
    cluster_ids = list(clusters.keys())
    random.shuffle(cluster_ids)
    split_point = int(len(cluster_ids) * (1 - test_ratio))
    train_clusters = cluster_ids[:split_point]
    test_clusters = cluster_ids[split_point:]
    return train_clusters, test_clusters


def extract_sequences(
    sequences: list[str],
    train_clusters: list[str],
    test_clusters: list[str],
    clusters: dict[str, list[str]],
):
    seq_dict = {f"seq_{i}": seq for i, seq in enumerate(sequences)}
    train_seqs = []
    test_seqs = []

    for cluster in train_clusters:
        train_seqs.extend([seq_dict[seq_id] for seq_id in clusters[cluster]])
    for cluster in test_clusters:
        test_seqs.extend([seq_dict[seq_id] for seq_id in clusters[cluster]])

    return train_seqs, test_seqs


def train_test_split_by_homology(
    sequences: list[str],
    max_seqs: int,
    test_ratio: float = 0.2,
    similarity_threshold: float = 0.3,
) -> tuple[set[str], set[str]]:
    """
    Given a list of sequences and a max_seqs cutoff:
    1. Take max_seqs sequences that don't have too much homology
    2. Split them into train and test sets
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        output_prefix = os.path.join(tmp_dir, "clusterRes")
        input_fasta = os.path.join(tmp_dir, "input_sequences.fasta")
        write_fasta(sequences, input_fasta)

        subprocess.run(
            [
                "mmseqs",
                "easy-cluster",
                input_fasta,
                output_prefix,
                tmp_dir,
                "--min-seq-id",
                str(similarity_threshold),
                "-c",
                "0.8",
                "--cov-mode",
                "1",
            ],
            check=True,
            stdout=subprocess.DEVNULL,  # Suppress printouts
        )

        clusters = parse_mmseqs2_clusters(f"{output_prefix}_cluster.tsv")

    # Get max_seqs clusters, split them into train and test
    filtered_clusters = dict(list(clusters.items())[:max_seqs])
    train_clusters, test_clusters = split_clusters(filtered_clusters, test_ratio)

    # For each cluster, take only the representative sequence so only dissimilar
    # sequences are kept
    seq_dict = {f"seq_{i}": seq for i, seq in enumerate(sequences)}
    train_seqs = {seq_dict[seq_id] for seq_id in train_clusters}
    test_seqs = {seq_dict[seq_id] for seq_id in test_clusters}

    logger.info(f"Train sequences: {len(train_seqs)}")
    logger.info(f"Test sequences: {len(test_seqs)}")
    return train_seqs, test_seqs


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


def get_annotation_entries_for_class(
    swissprot_df: pd.DataFrame,
    annotation: ResidueAnnotation,
    class_name: str,
) -> dict[str, list[dict]]:
    """
    Map each sequence to a list of annotations entries like:
    {
        "AAA": [
            {"start": 1, "end": 24, "note": "H-T-H motif"},
            {"start": 100, "end": 120, "note": "Homeobox"},
        ],
        ...
    }
    Downsample to max_seqs_per_task if necessary.
    """
    seq_to_annotation_entries = {}
    seq_lengths = []
    for _, row in swissprot_df[swissprot_df[annotation.name].notna()].iterrows():
        seq = row["Sequence"]
        entries = parse_swissprot_annotation(
            row[annotation.name], header=annotation.swissprot_header
        )
        if class_name != ResidueAnnotation.ALL_CLASSES:
            # The note field is sometimes like "Homeobox", "Homeobox 1", etc.,
            # so use string `in` to check.
            entries = [e for e in entries if class_name in e.get("note", "")]
        if len(entries) > 0 and len(seq) < MAX_SEQ_LEN:
            seq_to_annotation_entries[seq] = entries
            seq_lengths.append(len(seq))

    logger.info(
        f"Found {len(seq_to_annotation_entries)} sequences with class {class_name}. "
        f"Mean sequence length: {np.mean(seq_lengths):.2f}."
    )
    return seq_to_annotation_entries


def make_examples_from_annotation_entries(
    seq_to_annotation_entries: dict[str, list[dict]],
    tokenizer: AutoTokenizer,
    plm_model: EsmModel,
    sae_model: SparseAutoencoder,
    plm_layer: int,
    pool_over_annotation: bool = False,
) -> list[Example]:
    """
    Given a dict like this:
    ```
    {
        "AAA": [
            {"start": 1, "end": 24},
            {"start": 100, "end": 120},
        ],
        ...
    }
    ```
    Create an example for each residue in each sequence where:

    Input: SAE activation at the residue position
    Target: Boolean indicating whether the residue has an annotation with
    of given class, e.g. whether it falls within a motif of class
    "H-T-H motif".

    Returns a list of Example objects like
    ```
    [
        Example(sae_acts=[0.1, 0.2, 0.3, ...], target=True),
        Example(sae_acts=[0.4, 0.5, 0.6, ...], target=False),
        ...
    ]
    ```
    """
    examples = []
    for seq, entries in tqdm(
        seq_to_annotation_entries.items(),
        desc="Running ESM -> SAE inference",
    ):
        sae_acts = get_sae_acts(
            seq=seq,
            tokenizer=tokenizer,
            plm_model=plm_model,
            sae_model=sae_model,
            plm_layer=plm_layer,
        )

        if pool_over_annotation:
            for e in entries:
                start = e["start"] - 1
                end = e["end"]
                annotation_length = end - start
                examples.append(
                    Example(
                        sae_acts=np.mean(sae_acts[start:end], axis=0),
                        target=True,
                    )
                )

                # Sample 1-2 random annotations with the same length as the positive annotation
                # that don't overlap with the positive annotation as negative examples.
                if start >= annotation_length:
                    random_start_on_left = random.randint(0, start - annotation_length)
                    random_end_on_left = random_start_on_left + annotation_length
                    examples.append(
                        Example(
                            sae_acts=np.mean(
                                sae_acts[random_start_on_left:random_end_on_left], axis=0
                            ),
                            target=False,
                        )
                    )
                if end < len(seq) - annotation_length:
                    random_start_on_right = random.randint(end, len(seq) - annotation_length)
                    random_end_on_right = random_start_on_right + annotation_length
                    examples.append(
                        Example(
                            sae_acts=np.mean(
                                sae_acts[random_start_on_right:random_end_on_right], axis=0
                            ),
                            target=False,
                        )
                    )
        else:
            positive_positions = set()
            for e in entries:
                for i in range(e["start"] - 1, e["end"]):  # Swissprot is 1-indexed
                    positive_positions.add(i)

            for i, pos_sae_acts in enumerate(sae_acts):
                examples.append(
                    Example(
                        sae_acts=pos_sae_acts,
                        target=i in positive_positions,
                    )
                )

    num_positive_examples = sum(e.target for e in examples)
    logger.info(f"Made {len(examples)} examples ({num_positive_examples} positive)")
    return examples


def prepare_arrays_for_logistic_regression(
    df: pd.DataFrame,
    annotation: ResidueAnnotation,
    class_name: str,
    max_seqs_per_task: int,
    tokenizer: AutoTokenizer,
    plm_model: EsmModel,
    sae_model: SparseAutoencoder,
    plm_layer: int,
    pool_over_annotation: bool,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Given the swissprot dataframe and the desired annotation and class, creates examples that
    can be passed directly to logistic regression. This involves:
    1. Clustering the sequences by homology and downsampling to max_seqs_per_task dissimilar
        sequences
    2. Splitting the sequences into train and test sets
    3. ESM inference -> SAE inference -> get SAE activations for each residue in each sequence
    4. Create examples from the SAE activations and the binary target
    """
    # First, get all sequences with the target annotations
    seq_to_annotation_entries = get_annotation_entries_for_class(df, annotation, class_name)

    # Then, split into train and test
    train_seqs, test_seqs = train_test_split_by_homology(
        list(seq_to_annotation_entries.keys()), max_seqs=max_seqs_per_task
    )
    train_seq_to_annotation_entries = {
        seq: entries for seq, entries in seq_to_annotation_entries.items() if seq in train_seqs
    }
    test_seq_to_annotation_entries = {
        seq: entries for seq, entries in seq_to_annotation_entries.items() if seq in test_seqs
    }

    # Make examples for each split
    train_examples = make_examples_from_annotation_entries(
        seq_to_annotation_entries=train_seq_to_annotation_entries,
        tokenizer=tokenizer,
        plm_model=plm_model,
        sae_model=sae_model,
        plm_layer=plm_layer,
        pool_over_annotation=pool_over_annotation,
    )
    test_examples = make_examples_from_annotation_entries(
        seq_to_annotation_entries=test_seq_to_annotation_entries,
        tokenizer=tokenizer,
        plm_model=plm_model,
        sae_model=sae_model,
        plm_layer=plm_layer,
        pool_over_annotation=pool_over_annotation,
    )

    X_train = np.array([e.sae_acts for e in train_examples], dtype="float32")
    y_train = np.array([e.target for e in train_examples], dtype="bool")
    X_test = np.array([e.sae_acts for e in test_examples], dtype="float32")
    y_test = np.array([e.target for e in test_examples], dtype="bool")

    del train_seqs, test_seqs, train_seq_to_annotation_entries, test_seq_to_annotation_entries
    del train_examples, test_examples
    gc.collect()
    return X_train, y_train, X_test, y_test
