import json
import numpy as np

def calcualte_act_stats(tokens_acts_list: list[float]) -> float:
    """
    Calculate the average length of the features in the given list of token activations.
    Args:
        tokens_acts_list: list of token activations
    Returns:
        stats: dictionary
    """

    feature_lengths = []
    feature_starts = []
    cur_len = 0
    for i, act in enumerate(tokens_acts_list):
        if act == 0 and cur_len > 0:
            feature_lengths.append(cur_len)
            cur_len = 0
        elif act > 0 and cur_len == 0:
            feature_starts.append(i)
            cur_len += 1
        elif act > 0:
            cur_len += 1
    if cur_len > 0:
        feature_lengths.append(cur_len)

    dist_between_starts = [
        feature_starts[i] - feature_starts[i - 1] for i in range(1, len(feature_starts))
    ]

    stats = {
        "feature_lens": feature_lengths,
        "feature_starts": feature_starts,
        "dist_between_starts": dist_between_starts,
    }

    return stats


def analyze_viz_file(viz_file: str) -> dict:
    """
    Analyze the given visualization file.
    Args:
        viz_file: path to visualization json file
    Returns:
        stats: dictionary
    """
    with open(viz_file, "r") as f:
        data = json.load(f)

    all_stats = {
        "feature_lens": [],
        "feature_starts": [],
        "dist_between_starts": [],
    }
    for entry in data:
        stats = calcualte_act_stats(entry['tokens_acts_list'])
        all_stats['feature_lens'].extend(stats['feature_lens'])
        all_stats['feature_starts'].extend(stats['feature_starts'])
        all_stats['dist_between_starts'].extend(stats['dist_between_starts'])

    max_feature_lens = np.amax(all_stats['feature_lens'])
    mean_feature_lens = np.mean(all_stats['feature_lens'])
    std_feature_lens = np.std(all_stats['feature_lens'])
    mean_dist_between_starts = np.mean(all_stats['dist_between_starts'])
    std_dist_between_starts = np.std(all_stats['dist_between_starts'])

    
    return {
        "max_feature_lens": round(max_feature_lens, 2),
        "mean_feature_lens": round(mean_feature_lens, 2),
        "std_feature_lens": round(std_feature_lens, 2),
        "mean_dist_between_starts": round(mean_dist_between_starts, 2),
        "std_dist_between_starts": round(std_dist_between_starts, 2),
    }
