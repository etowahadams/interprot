import unittest
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd
from click.testing import CliRunner
from sklearn.model_selection import train_test_split

from interprot.oned_probe.single_latent import single_latent


class TestSingleLatentProbe(unittest.TestCase):
    @patch("interprot.oned_probe.single_latent.prepare_arrays_for_logistic_regression")
    @patch("interprot.oned_probe.single_latent.torch.load")
    @patch("interprot.oned_probe.single_latent.AutoTokenizer.from_pretrained")
    @patch("interprot.oned_probe.single_latent.EsmModel.from_pretrained")
    @patch("interprot.oned_probe.single_latent.SparseAutoencoder")
    def test_single_latent_e2e(
        self,
        mock_sae,
        mock_esm,
        mock_tokenizer,
        mock_torch_load,
        mock_prepare_arrays_for_logistic_regression,
    ):
        mock_torch_load.return_value = {}
        mock_tokenizer.return_value = None
        mock_esm.return_value = Mock(to=Mock())
        mock_sae.return_value = Mock(to=Mock())

        # Mock SAE activations to make hidden dim 2 correlate perfectly with the
        # test annotations
        true_sae_acts, false_sae_acts = np.zeros((10,)), np.zeros((10,))
        true_sae_acts[2] = 1

        mock_examples = [(true_sae_acts, True) for _ in range(100)] + [
            (false_sae_acts, False) for _ in range(100)
        ]
        train_examples, test_examples = train_test_split(
            mock_examples, test_size=0.1, random_state=42
        )
        mock_prepare_arrays_for_logistic_regression.return_value = (
            np.vstack([x[0] for x in train_examples]),
            np.array([x[1] for x in train_examples]),
            np.vstack([x[0] for x in test_examples]),
            np.array([x[1] for x in test_examples]),
        )

        runner = CliRunner()
        with runner.isolated_filesystem():
            with open("dummy.pt", "w") as f:
                f.write("dummy checkpoint")
            with open("dummy.tsv", "w") as f:
                f.write("dummy swissprot data")

            result = runner.invoke(
                single_latent,
                [
                    "--sae-checkpoint",
                    "dummy.pt",
                    "--sae-dim",
                    "10",
                    "--plm-dim",
                    "1280",
                    "--plm-layer",
                    "24",
                    "--swissprot-tsv",
                    "dummy.tsv",
                    "--output-dir",
                    "dummy_output",
                    "--annotation-names",
                    "DNA binding",
                    "--max-seqs-per-task",
                    "4",
                ],
            )
            print(result.output, result.exception)
            self.assertEqual(result.exit_code, 0)
            results_df = pd.read_csv("dummy_output/DNA binding/H-T-H motif.csv")

        # Check that hidden dim 2 has perfect precision, recall, and F1,
        # whereas the rest of the dims should have 0.
        for _, row in results_df.iterrows():
            if row["dim"] == 2:
                self.assertEqual(row["precision"], 1)
                self.assertEqual(row["recall"], 1)
                self.assertEqual(row["f1"], 1)
            else:
                self.assertEqual(row["precision"], 0)
                self.assertEqual(row["recall"], 0)
                self.assertEqual(row["f1"], 0)
