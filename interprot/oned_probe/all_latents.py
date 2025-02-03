import gc
import warnings

import click
import pandas as pd
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score
from transformers import AutoTokenizer, EsmModel

from interprot.oned_probe.annotations import (
    RESIDUE_ANNOTATION_NAMES,
    RESIDUE_ANNOTATIONS,
)
from interprot.oned_probe.logging import logger
from interprot.oned_probe.utils import (
    prepare_arrays_for_logistic_regression,
)
from interprot.sae_model import SparseAutoencoder


@click.command()
@click.option(
    "--sae-checkpoint",
    type=click.Path(exists=True),
    required=True,
    help="Path to the SAE checkpoint file",
)
@click.option("--sae-dim", type=int, required=True, help="Dimension of the sparse autoencoder")
@click.option("--plm-dim", type=int, required=True, help="Dimension of the protein language model")
@click.option(
    "--plm-layer",
    type=int,
    required=True,
    help="Layer of the protein language model to use",
)
@click.option(
    "--swissprot-tsv",
    type=click.Path(exists=True),
    required=True,
    help="Path to the SwissProt TSV file",
)
@click.option(
    "--output-file",
    type=click.Path(),
    required=True,
    help="Path to the output file",
)
@click.option(
    "--annotation-names",
    type=click.STRING,
    multiple=True,
    help="List of annotation names to process. If not provided, all annotations will be processed.",
)
@click.option(
    "--max-seqs-per-task",
    type=int,
    default=1000,
    help="Maximum number of sequences to use for a given logistic regression task",
)
def all_latents(
    sae_checkpoint: str,
    sae_dim: int,
    plm_dim: int,
    plm_layer: int,
    swissprot_tsv: str,
    output_file: str,
    annotation_names: list[str],
    max_seqs_per_task: int,
):
    for name in annotation_names:
        if name not in RESIDUE_ANNOTATION_NAMES:
            raise ValueError(f"Invalid annotation name: {name}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.debug(f"Using device: {device}")

    # Load pLM and SAE
    tokenizer = AutoTokenizer.from_pretrained("facebook/esm2_t33_650M_UR50D")
    plm_model = EsmModel.from_pretrained("facebook/esm2_t33_650M_UR50D").to(device).eval()
    sae_model = SparseAutoencoder(plm_dim, sae_dim).to(device)
    sae_model.load_state_dict(torch.load(sae_checkpoint, map_location=device))

    df = pd.read_csv(swissprot_tsv, sep="\t")

    res_rows = []
    for annotation in RESIDUE_ANNOTATIONS:
        if annotation_names and annotation.name not in annotation_names:
            continue

        logger.info(f"Processing annotation: {annotation.name}")

        for class_name in annotation.class_names:
            X_train, y_train, X_test, y_test = prepare_arrays_for_logistic_regression(
                df=df,
                annotation=annotation,
                class_name=class_name,
                max_seqs_per_task=max_seqs_per_task,
                tokenizer=tokenizer,
                plm_model=plm_model,
                sae_model=sae_model,
                plm_layer=plm_layer,
                pool_over_annotation=False,
            )
            with warnings.catch_warnings():
                # LogisticRegression throws warnings when it can't converge.
                # This is expected for most dimensions.
                warnings.simplefilter("ignore")

                model = LogisticRegression(class_weight="balanced")
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                precision = precision_score(y_test, y_pred)
                recall = recall_score(y_test, y_pred)
                f1 = f1_score(y_test, y_pred)

                logger.info(f"Precision: {precision}, Recall: {recall}, F1: {f1}")

                weights = model.coef_[0]
                res_rows.append(
                    [annotation.name, class_name, precision, recall, f1] + weights.tolist()
                )

            res_df = pd.DataFrame(
                res_rows,
                columns=["annotation", "class", "precision", "recall", "f1"]
                + [f"weight_{i}" for i in range(sae_dim)],
            )
            res_df.to_csv(output_file, index=False)
            logger.info(f"Results saved to {output_file}")

            del X_train, y_train, X_test, y_test
            gc.collect()
