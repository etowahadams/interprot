from pathlib import Path

import click

from interprot.make_viz_files.compute_family_specificity import (
    compute_family_specifc_features,
)


@click.command()
@click.option(
    "--parquet-path",
    type=click.Path(exists=True),
    required=True,
    help="Path to the parquet file containing the sequence data.",
)
@click.option(
    "--top-acts-npy",
    type=click.Path(exists=True),
    required=True,
    help="Path to the numpy file containing the top activations for each sequence.",
)
@click.option(
    "--total-dims",
    type=int,
    default=4096,
    help="The total number of dimensions. Defaults to 4096.",
)
@click.option(
    "--class-list-col",
    type=str,
    default="InterPro",
    help='The column name containing the list of classes. Defaults to "InterPro".',
)
@click.option(
    "--output-parquet",
    type=click.Path(),
    default="family_specific_features.parquet",
)
def main(parquet_path, top_acts_npy, total_dims, class_list_col, output_parquet):
    df = compute_family_specifc_features(
        Path(parquet_path), Path(top_acts_npy), total_dims, class_list_col
    )
    df.write_parquet(output_parquet)


if __name__ == "__main__":
    main()
