import json
from pathlib import Path

import numpy as np
import polars as pl
from tqdm import tqdm


def compute_all_feature_stats(viz_file_dir: Path, ouput_dir: Path, hidden_dim: int) -> None:
    """
    Computes all feature stats and writes them to a parquet file. This is the main runner function

    Args:
        viz_file_dir: Path to the directory containing the viz files. Expects that the viz files
            have a certain structure, and are named with the SAE dimension as the filename.
        output_dir: Path to the directory where the output parquet file will be written.
        hidden_dim: The number of hidden dimensions in the SAE model.

    """
    print("Computing sequence stats. This should take a few mins...")
    # Calculate metrics about each sequence
    seqeunce_stats = calculate_sequence_metrics(viz_file_dir)

    print("Aggregating sequence stats to dim level...")
    # Aggregate the sequence stats to get dim level stats
    feature_stats = calulate_dim_metrics(seqeunce_stats, hidden_dim)
    # Now the features are ready to be classified
    feat_types = []
    for row in feature_stats.rows(named=True):
        feat_types.append(classify_into_type(row))
    # add the feature type to the feature stats
    summary_labels = feature_stats.with_columns(pl.Series("feat_type", feat_types))
    # write the feature stats to a parquet file
    print("Writing feature stats to parquet file")
    output_file = ouput_dir / f"feature_stats.parquet"
    summary_labels.write_parquet(output_file)


def calculate_sequence_metrics(json_dir: Path) -> pl.DataFrame:
    """
    Calculates stats for each sequence in each seqeunce file.
    Final dataframe will have one row for each sequence.

    This function assumes that the viz files have a certain structure.
    """
    final_stats = []

    for file in tqdm(json_dir.iterdir()):
        try: 
            with open(file, "r") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading file {file}")
            print(e)
            continue

        dim_name = file.stem

        top_examples = data["ranges"]["0.75-1"]["examples"]
        freq_active = data["freq_active"]
        max_act = np.max([np.max(example["sae_acts"]) for example in top_examples])
        for example in top_examples:
            tokens_acts_list = np.array(example["sae_acts"]) / max_act
            stats = calculate_act_stats(tokens_acts_list)
            stats["dim"] = dim_name
            stats["freq_active"] = freq_active
            stats["uniprot"] = example["uniprot_id"]
            final_stats.append(stats)

    final_stats = pl.DataFrame(final_stats)
    return final_stats

def calulate_dim_metrics(final_stats: pl.DataFrame, hidden_dim: int) -> pl.DataFrame:
    """
    Takes the output of calculate_sequence_metrics calculates dim level stats.
    Output is a df which each row is a different SAE dim
    """
    summary = []
    for name, data in final_stats.group_by("dim"):
        ##### Calculate stats to help determine periodicity
        # I found that periodic features seem will mostly have the distance between starts
        # to mostly be one or two number, so I calculate
        # the frequency of the top two most common distances between starts
        starts = data["dist_between_starts"].to_numpy()
        start_counts = np.bincount(np.concatenate(starts).ravel())
        top_two_indices = np.argsort(start_counts)[-2:]
        if len(top_two_indices) == 2:
            top_index = top_two_indices[-1]
            freq_top_two_period = np.sum(start_counts[top_two_indices]) / np.sum(
                start_counts
            )
            freq_top_period = np.sum(start_counts[top_index]) / np.sum(start_counts)
        elif len(top_two_indices) == 1:
            top_index = top_two_indices[0]
            freq_top_two_period = 0
            freq_top_period = np.sum(start_counts[top_index]) / np.sum(start_counts)
        else:
            top_index = 0
            freq_top_two_period = 0
            freq_top_period = 0

        # Calculate the mean number of contigs across the sequencs
        act_maxes = np.concatenate(data["max_act"].to_numpy()).ravel()
        freq_gt_75 = np.sum(act_maxes > 0.75) / len(act_maxes)
        median_contigs_per_seq = np.median(data["n_contigs"].to_numpy())
        mean_percent_active = data["percent_active"].mean()
        contig_lens = np.concatenate(data["contig_lens"].to_numpy()).ravel()
        std_err_contig_len = np.sqrt(contig_lens.var() / len(contig_lens))

        # Calculate some stats about the motifs
        motifs = (
            data.explode(
                "contig_lens",
                "max_act",
                "contig_starts",
                "is_gapped",
                "len_gt_75",
                "len_longest_increasing_stretch",
                "len_longest_decreasing_stretch",
            )
            .filter(pl.col("max_act") > 0.75)
            .sort("max_act", descending=True)
        )
        top_motif_each_seq = motifs.unique("uniprot", maintain_order=True)

        median_len_top_contig = top_motif_each_seq["contig_lens"].median()
        median_contig_length_gt_75 = motifs["contig_lens"].median()
        median_increasing_stretch = max(
            motifs["len_longest_increasing_stretch"].median(),
            motifs["len_longest_decreasing_stretch"].median(),
            0,
        )
        freq_increase_gt_2_gt_75 = np.sum(
            motifs["len_longest_increasing_stretch"].to_numpy() > 2
        ) / len(motifs)
        freq_decrease_gt_2_gt_75 = np.sum(
            motifs["len_longest_decreasing_stretch"].to_numpy() > 2
        ) / len(motifs)

        try:
            std_err_contig_len_gt_75 = np.sqrt(
                motifs["contig_lens"].var() / len(motifs)
            )
        except Exception:
            # if there is only one contig, the variance will be 0
            std_err_contig_len_gt_75 = 0

        try:
            std_err_contig_len75 = np.sqrt(motifs["len_gt_75"].var() / len(motifs))
        except Exception:
            std_err_contig_len75 = 0
        is_top_gapped = any(motifs["is_gapped"][:2])
        mean_contigs_per_seq_gt_75 = len(motifs) / len(data)

        summary.append(
            {
                # the name of the dimension
                "dim": name[0],
                # the median percent of the sequence that is active
                "mean_percent_active": mean_percent_active,
                # median length of the top contig from each seqeunce
                "median_len_top_contig": median_len_top_contig,
                # the frequency contigs which have a max activation > 0.75
                "freq_contig_gt_75": freq_gt_75,
                # the median length of the contigs which have a max activation greater than 0.75
                "med_contig_length_gt_75": median_contig_length_gt_75,
                # the frequency of contigs (with max act > 0.75) with a monotonically increasing
                # stretch of greater than 2
                "freq_increase_gt_2_gt_75": freq_increase_gt_2_gt_75,
                # the frequency of contigs (with max act > 0.75) with a monotonically decreasing
                # stretch of greater than 2
                "freq_decrease_gt_2_gt_75": freq_decrease_gt_2_gt_75,
                # median longest increasing/decreasing stretch
                "med_monotonic_stretch_len": median_increasing_stretch,
                # standard error of the contigs lens with max act > 0.75
                "std_err_contig_len_gt_75": std_err_contig_len_gt_75,
                # the frequency of the top two distances between contig starts
                "freq_top_two_period": freq_top_two_period,
                # the frequency of the top distance (period) between contig starts
                "freq_top_period": freq_top_period,
                "top_period": top_index,
                # the mean number of contigs across the sequences
                "med_contigs_per_seq": median_contigs_per_seq,
                # the mean number of contigs with max act > 0.75 per seqeunce
                "mean_contigs_per_seq_gt_75": mean_contigs_per_seq_gt_75,
                # standard error of the contigs lens
                "std_err_contig_len": std_err_contig_len,
                # standard error of the len of the parts of the contig with max act > 0.75
                "std_err_contig_len75": std_err_contig_len75,
                # whether the contig with highest max activation is gapped
                "is_top_gapped_gt_75": is_top_gapped,
                # the number of sequences which have been evaluated on for this dimension
                "n_seqs": len(data),
                # the frequency that this feature fires across all sequences
                "freq_active_global": data["freq_active"].mean(),
                # is dead feature
                "dead_latent": False,
            }
        )

    # Identify dead latents
    all_dims = set([str(i) for i in range(hidden_dim)])
    summarized_dims = set(final_stats["dim"].unique())
    dead_latents = all_dims - summarized_dims

    for dim in dead_latents:
        summary.append(
            {
                "dim": dim,
                "mean_percent_active": 0,
                "median_len_top_contig": 0,
                "freq_contig_gt_75": 0,
                "med_contig_length_gt_75": 0,
                "freq_increase_gt_2_gt_75": 0,
                "freq_decrease_gt_2_gt_75": 0,
                "med_monotonic_stretch_len": 0,
                "std_err_contig_len_gt_75": 0,
                "freq_top_two_period": 0,
                "freq_top_period": 0,
                "top_period": 0,
                "med_contigs_per_seq": 0,
                "mean_contigs_per_seq_gt_75": 0,
                "std_err_contig_len": 0,
                "std_err_contig_len75": 0,
                "is_top_gapped_gt_75": False,
                "n_seqs": 0,
                "freq_active_global": 0,
                "dead_latent": True,
            }
        )
    summary = pl.DataFrame(summary)
    return summary


# TODO: Update this to better gapping method 
def check_is_gapped(current_selection: list[float]) -> bool:
    UPPER_THRESHOLD = 0.75
    BOTTOM_THRESHOLD = 0.1
    in_gap = False
    for i in range(1, len(current_selection)):
        if (
            current_selection[i] < BOTTOM_THRESHOLD
            and current_selection[i - 1] > UPPER_THRESHOLD
        ):
            in_gap = True
        elif in_gap and current_selection[i] > UPPER_THRESHOLD:
            return True
    return False


def longest_increasing_and_decreasing_stretch(
    current_selection: list[float],
) -> tuple[int, int]:
    longest_increasing = 0
    longest_decreasing = 0
    cur_increasing = 0
    cur_decreasing = 0
    for i in range(1, len(current_selection)):
        if current_selection[i] > current_selection[i - 1]:
            cur_increasing += 1
            cur_decreasing = 0
        elif current_selection[i] < current_selection[i - 1]:
            cur_decreasing += 1
            cur_increasing = 0
        else:
            cur_decreasing = 0
            cur_increasing = 0
        longest_increasing = max(longest_increasing, cur_increasing)
        longest_decreasing = max(longest_decreasing, cur_decreasing)
    return longest_increasing, longest_decreasing


def calculate_act_stats(tokens_acts_list: list[float]) -> float:
    """
    Calculate the average length of the features in the given list of token activations.
    Args:
        tokens_acts_list: list of token activations
    Returns:
        stats: dictionary
    """

    contig_lens = []
    contig_starts = []
    max_within_contiguous = []
    longest_increasing = []
    longest_decreasing = []
    gaps = []
    len_gt_75 = []
    cur_len = 0

    def record_contig(i, cur_len):
        contig_lens.append(cur_len)
        current_section = tokens_acts_list[i - cur_len : i]
        max_within_contiguous.append(np.max(current_section))
        current_selection = tokens_acts_list[i - cur_len : i]
        if not np.any(current_selection > 0.75):
            gaps.append(False)
        else:
            gaps.append(check_is_gapped(current_selection))
        len_gt_75.append(np.sum(current_selection > 0.75))
        increasing, decreasing = longest_increasing_and_decreasing_stretch(
            current_selection
        )
        longest_increasing.append(increasing)
        longest_decreasing.append(decreasing)

    for i, act in enumerate(tokens_acts_list):
        if act == 0 and cur_len > 0:
            record_contig(i, cur_len)
            cur_len = 0
        elif act > 0 and cur_len == 0:
            contig_starts.append(i)
            cur_len += 1
        elif act > 0:
            cur_len += 1

    if cur_len > 0:
        record_contig(len(tokens_acts_list), cur_len)

    dist_between_starts = [
        contig_starts[i] - contig_starts[i - 1] for i in range(1, len(contig_starts))
    ]

    stats = {
        # the lengths of all of the non-zero contigs
        "contig_lens": contig_lens,
        # the number of non-zero contigs in the seqeunce
        "n_contigs": len(contig_lens),
        # the index of the contig starts
        "contig_starts": contig_starts,
        # the max activation within each contiguous section
        "max_act": max_within_contiguous,
        # whether each contig has a gap in it
        "is_gapped": gaps,
        # the distance between the starts of each contig
        "dist_between_starts": dist_between_starts,
        # percent of sequence has a non-zero activation
        "percent_active": np.sum(tokens_acts_list > 0) / len(tokens_acts_list),
        # length the values in the contig with activation greater than 0.75
        "len_gt_75": len_gt_75,
        # len of longest increasing stretch in each contig
        "len_longest_increasing_stretch": longest_increasing,
        # len longest decreasing stretch in each contig
        "len_longest_decreasing_stretch": longest_decreasing,
    }

    return stats

def classify_into_type(row):
    if row["n_seqs"] < 5:
        return "not enough data"
    if row['dead_latent']:
        return 'dead latent'

    has_consistant_starts = row["freq_top_two_period"] > 0.5
    has_large_number_of_contigs = row["med_contigs_per_seq"] > 10
    not_super_long_contigs = row["median_len_top_contig"] < 10
    if has_consistant_starts and has_large_number_of_contigs and not_super_long_contigs:
        return "periodic"

    if row["med_contig_length_gt_75"] == 1:
        return "point"
    if row["freq_contig_gt_75"] > 0.1 and row["mean_percent_active"] < 0.8:
        if row["median_len_top_contig"] < 20:
            return "short motif (1-20)"
        if row["median_len_top_contig"] < 50:
            return "med motif (20-50)"
        if row["median_len_top_contig"] < 300:
            return "long motif (50-300)"

    if row["mean_percent_active"] > 0.8:
        return "whole"

    return "other"
