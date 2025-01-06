from pathlib import Path

import numpy as np
import polars as pl
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from tqdm import tqdm


def compute_family_specifc_features(
    parquet_path: Path,
    top_acts_npy: Path,
    total_dims=4096,
    class_list_col: str = "InterPro",
):
    """
    This is the entry point for computing family specific features. It takes in a parquet file
    and a numpy file containing the top activations for each sequence and computes the family
    specific features for each dimension. The family specific features are computed by finding
    the highest activating sequence for each dimension and then optimizing the threshold for
    classifying a sequence as a member of the family or not.

    Args:
        parquet_path (Path): Path to the parquet file containing the sequence data.
        top_acts_npy (Path): Path to the numpy file containing the top activations for each sequence
        total_dims (int, optional): The total number of dimensions. Defaults to 4096.
        class_list_col (str, optional): The column name containing the list of classes. 

    Returns:
        pl.DataFrame: A DataFrame containing the family specific features for each dimension.
    """
    df = pl.read_parquet(parquet_path)
    df = df.with_columns(
        pl.col(class_list_col).str.strip_chars(";").str.split(";").alias(class_list_col)
    )
    data = np.load(top_acts_npy)

    try:
        assert data.shape[0] == total_dims
    except AssertionError:
        print(
            f"We expect there to be a row for each dim. There were {data.shape[0]} rows \
              and we expected {total_dims}"
        )
    try:
        assert data.shape[1] == len(df)
    except AssertionError:
        print(
            f"We expect there to be a column for each sequence. There were {data.shape[1]} \
              columns and we expected {len(df)}"
        )

    data_only_df = df[["Entry", class_list_col]]
    all_results = []
    for dim in tqdm(range(total_dims), smoothing=0):
        df_dim = add_normalized_acts(data_only_df, data, dim)
        df_dim = df_dim.sort("act", descending=True)
        first_row = df_dim.filter(pl.col("act") == 1).head(1)
        try:
            highest_act_classes = first_row[class_list_col][0]
        except Exception:
            highest_act_classes = None
        if highest_act_classes is not None:
            for i, class_name in enumerate(highest_act_classes.to_list()):
                df_class = add_class_label(df_dim, class_list_col, class_name)
                result = optimize_f1_boundary(df_class)
                result["dim"] = dim
                result["class"] = class_name
                all_results.append(result)

    return pl.DataFrame(all_results)

def optimize_f1_boundary(df: pl.DataFrame, x_col="act", y_col="class"):
    """
    This function optimizes the threshold for classifying a sequence as a member of the family
    or not. It does this by iterating through a range of possible thresholds and selecting the one
    that maximizes the F1 score. The process is similar to what is done in Simon & Zou 2023.

    We find this to be much more robust than doing likelihood maximization, which is sensitive to
    class imbalance.

    """
    # Extract features and labels
    X = df[x_col].to_numpy()
    y = df[y_col].to_numpy()

    # split into test and train
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.5, random_state=42
    )

    best_f1 = 0
    best_threshold = 0

    # Iterate through all possible thresholds
    for threshold in np.linspace(0.3, 0.9, 7).tolist():

        # Predictions based on threshold
        y_pred = (X_train >= threshold).astype(int)

        # Calculate F1 score
        current_f1 = f1_score(y_train, y_pred, zero_division=0)

        # Update best F1 and threshold if current F1 is better
        if current_f1 > best_f1:
            best_f1 = current_f1
            best_threshold = threshold

    # evaluate on test
    y_pred = (X_test >= best_threshold).astype(int)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred)
    # Return the optimal threshold and the best F1 score
    return {
        "threshold": best_threshold,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "n_data_points": y.sum(),
    }


def add_normalized_acts(df, max_act_matrix, dim):
    normalized_acts = max_act_matrix[dim] / max_act_matrix[dim].max()
    df_dim = df.with_columns(pl.Series(normalized_acts).alias("act"))
    return df_dim


def add_class_label(df, col_name, class_name):
    # Explode the column to handle lists or nested values
    exploded = df.explode(col_name)

    # Add a "class" column based on whether the value in col_name matches class_name
    exploded = exploded.with_columns(
        (pl.col(col_name) == class_name).cast(pl.Int8).alias("class")
    )
    # set the null values in class to 0
    exploded = exploded.with_columns(pl.col("class").fill_null(0))

    # Remove duplicate rows based on "Entry", prioritizing rows with class=1
    return exploded.sort("class", descending=True).unique(
        subset=["Entry"], maintain_order=True
    )
