import unittest
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd

from interprot.oned_probe.annotations import ResidueAnnotation
from interprot.oned_probe.utils import (
    Example,
    get_annotation_entries_for_class,
    make_examples_from_annotation_entries,
    train_test_split_by_homology,
)


class TestUtils(unittest.TestCase):
    @patch("interprot.oned_probe.utils.get_sae_acts")
    def test_make_examples_from_annotation_entries(self, mock_get_sae_acts):
        # Mock the necessary objects
        mock_tokenizer = Mock()
        mock_plm_model = Mock()
        mock_sae_model = Mock()

        # Set up test data
        seq_to_annotation_entries = {
            "ABCDEF": [
                {"start": 2, "end": 4},
            ],
            "GHIJKL": [
                {"start": 1, "end": 2},
                {"start": 5, "end": 5},
            ],
        }

        mock_get_sae_acts.side_effect = [
            [
                [0.1, 0.2],
                [0.3, 0.4],
                [0.5, 0.6],
                [0.7, 0.8],
                [0.9, 1.0],
                [1.1, 1.2],
            ],  # For "ABCDEF"
            [
                [1.3, 1.4],
                [1.5, 1.6],
                [1.7, 1.8],
                [1.9, 2.0],
                [2.1, 2.2],
                [2.3, 2.4],
            ],  # For "GHIJKL"
        ]

        examples = make_examples_from_annotation_entries(
            seq_to_annotation_entries,
            mock_tokenizer,
            mock_plm_model,
            mock_sae_model,
            plm_layer=24,
        )

        self.assertEqual(len(examples), 12)
        self.assertEqual(examples[0], Example(sae_acts=np.array([0.1, 0.2]), target=False))
        self.assertEqual(examples[1], Example(sae_acts=np.array([0.3, 0.4]), target=True))
        self.assertEqual(examples[2], Example(sae_acts=np.array([0.5, 0.6]), target=True))
        self.assertEqual(examples[3], Example(sae_acts=np.array([0.7, 0.8]), target=True))

        self.assertEqual(examples[6], Example(sae_acts=np.array([1.3, 1.4]), target=True))
        self.assertEqual(examples[7], Example(sae_acts=np.array([1.5, 1.6]), target=True))
        self.assertEqual(examples[8], Example(sae_acts=np.array([1.7, 1.8]), target=False))
        self.assertEqual(examples[9], Example(sae_acts=np.array([1.9, 2.0]), target=False))
        self.assertEqual(examples[10], Example(sae_acts=np.array([2.1, 2.2]), target=True))

        mock_get_sae_acts.assert_any_call(
            seq="ABCDEF",
            tokenizer=mock_tokenizer,
            plm_model=mock_plm_model,
            sae_model=mock_sae_model,
            plm_layer=24,
        )
        mock_get_sae_acts.assert_any_call(
            seq="GHIJKL",
            tokenizer=mock_tokenizer,
            plm_model=mock_plm_model,
            sae_model=mock_sae_model,
            plm_layer=24,
        )

    @patch("interprot.oned_probe.utils.get_sae_acts")
    def test_make_examples_from_annotation_entries_pool_over_annotation(self, mock_get_sae_acts):
        seq_to_annotation_entries = {
            "AAAAAAAAAA": [{"start": 4, "end": 6}],
            "CCCCCCCCCC": [{"start": 1, "end": 3}, {"start": 5, "end": 6}],
        }

        mock_tokenizer = Mock()
        mock_plm_model = Mock()
        mock_sae_model = Mock()

        mock_get_sae_acts.side_effect = [
            [
                [0.1, 0.2],
                [0.3, 0.4],
                [0.5, 0.6],
                [0.7, 0.8],
                [0.9, 1.0],
                [1.1, 1.2],
                [1.3, 1.4],
                [1.5, 1.6],
                [1.7, 1.8],
                [1.9, 2.0],
            ],
            [
                [2.1, 2.2],
                [2.3, 2.4],
                [2.5, 2.6],
                [2.7, 2.8],
                [2.9, 3.0],
                [3.1, 3.2],
                [3.3, 3.4],
                [3.5, 3.6],
                [3.7, 3.8],
                [3.9, 4.0],
            ],
        ]

        examples = make_examples_from_annotation_entries(
            seq_to_annotation_entries,
            mock_tokenizer,
            mock_plm_model,
            mock_sae_model,
            plm_layer=24,
            pool_over_annotation=True,
        )

        # 8 examples: 3 positive, 5 negative
        self.assertEqual(len(examples), 8)

        self.assertIn(
            Example(sae_acts=np.mean([[0.7, 0.8], [0.9, 1.0], [1.1, 1.2]], axis=0), target=True),
            examples,
        )
        self.assertIn(
            Example(sae_acts=np.mean([[2.1, 2.2], [2.3, 2.4], [2.5, 2.6]], axis=0), target=True),
            examples,
        )
        self.assertIn(
            Example(sae_acts=np.mean([[2.9, 3.0], [3.1, 3.2]], axis=0), target=True),
            examples,
        )
        self.assertEqual(len([e for e in examples if e.target is False]), 5)

    def test_get_annotation_entries_for_class(self):
        mock_df = pd.DataFrame(
            {
                "Sequence": ["ABCDEF", "GHIJKL", "MNOPQR"],
                "DNA binding": [
                    'DNA_BIND 1..3; /note="H-T-H motif"',
                    'DNA_BIND 2..4; /note="Homeobox"',
                    'DNA_BIND 1..6; /note="Nuclear receptor"',
                ],
            }
        )

        annotation = ResidueAnnotation(
            name="DNA binding",
            swissprot_header="DNA_BIND",
            class_names=["H-T-H motif", "Homeobox", "Nuclear receptor"],
        )

        result = get_annotation_entries_for_class(mock_df, annotation, "H-T-H motif")
        self.assertEqual(len(result), 1)
        self.assertIn("ABCDEF", result)
        self.assertEqual(result["ABCDEF"], [{"start": 1, "end": 3, "note": "H-T-H motif"}])

        result = get_annotation_entries_for_class(mock_df, annotation, "Homeobox")
        self.assertEqual(len(result), 1)
        self.assertIn("GHIJKL", result)
        self.assertEqual(result["GHIJKL"], [{"start": 2, "end": 4, "note": "Homeobox"}])

        result = get_annotation_entries_for_class(
            mock_df, annotation, ResidueAnnotation.ALL_CLASSES
        )
        self.assertEqual(len(result), 3)
        self.assertIn("ABCDEF", result)
        self.assertIn("GHIJKL", result)
        self.assertIn("MNOPQR", result)

        result = get_annotation_entries_for_class(mock_df, annotation, "Non-existent")
        self.assertEqual(len(result), 0)

    def test_train_test_split_by_homology(self):
        sequences = [
            # 2 similar sequences that should be clustered together
            "MSPGNTTVVTTTVRNATPSLALDAGTIERFLAHSHRRRYPTRTDVFRPGDPAGTLYYVIS",
            "MSPGNTTTVTTTVRNATPSLALDAGTIERFLAHSHRRRYPTRTDVFRPGDPAGALYYVIS",
            # A couple of dissimilar sequences
            "MIPEKRIIRRIQSGGCAIHCQDCSISQLCIPFTLNEHELDQLDNIIERKKPIQKGQTLFKAGDELKSLYAIRSGTIKSYTITE"
            "LVERSLKQLFRQQTGMSISHYLRQIRLCHAKCLLRGSEHRISDIAARCGFEDSNYFSAVFTREAGMTPRDYRQRFIRSPVLPTKNEP",
            "IQQLAQESRKTDSWSIQLTEVLLLQLAIVLKRHRYRAEQAHLLPDGEQLDLIMSALQQSLGAYFDMANFCHKNQ",
            "PSERELMAFFNVGRPSVREALAALKRKGLVQINNGERARVSRPSADTIISELSGLAKDFL",
        ]

        train_seqs, test_seqs = train_test_split_by_homology(
            sequences=sequences,
            max_seqs=4,
            test_ratio=0.2,
            similarity_threshold=0.4,
        )

        filtered_seqs = train_seqs | test_seqs
        self.assertEqual(len(filtered_seqs), 4)

        # One of the first 2 seqs should be filtered out because of homology
        self.assertTrue(sequences[0] not in filtered_seqs or sequences[1] not in filtered_seqs)

        # 0.2 test ratio, max 4 seqs -> 1 test seq, 3 train seqs
        self.assertEqual(len(train_seqs), 3)
        self.assertEqual(len(test_seqs), 1)
