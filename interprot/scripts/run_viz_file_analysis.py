from pathlib import Path

import click

from interprot.make_viz_files.analyze_viz_files import compute_all_feature_stats


@click.command()
@click.option(
    "--viz-file-dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    required=True,
    help="Directory containing visualization files",
)
@click.option(
    "--output-dir",
    type=click.Path(file_okay=False, path_type=Path),
    required=True,
    help="Directory to save the output files",
)
@click.option("--hidden-dim", type=int, required=True, help="Hidden dimension size")
def main(viz_file_dir: Path, output_dir: Path, hidden_dim: int):
    """
    Compute feature statistics for all visualization files in the given directory.
    """
    compute_all_feature_stats(viz_file_dir, output_dir, hidden_dim)


if __name__ == "__main__":
    main()
