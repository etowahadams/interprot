import os

import pandas as pd
import torch
import torch.nn as nn


class LinearClassifier(nn.Module):
    """Linear classifier"""

    def __init__(self, input_dim: int, numb_class: int):
        """
        Args:
        - input_dim: int,
        - numb_class: int, the number of classes
        """
        super(LinearClassifier, self).__init__()
        self.linear = nn.Linear(input_dim, numb_class)

    def forward(self, x: torch.tensor) -> torch.tensor:
        return self.linear(x)

    def write_weights_to_csv(self, output_dir: str):
        """Write model weights to CSV files in sorted order.

        For multi-class models, writes one CSV per class.
        Each CSV has columns "Index" and "Coefficient" sorted descending.

        Args:
            output_dir: Directory to write CSV files to
        """
        weights = self.linear.weight.detach().cpu()
        os.makedirs(output_dir, exist_ok=True)

        for class_idx in range(weights.shape[0]):
            class_weights = weights[class_idx]
            df = pd.DataFrame({"Index": range(len(class_weights)), "Weight": class_weights.numpy()})
            df = df.reindex(df["Weight"].sort_values(ascending=False).index)
            output_file = os.path.join(output_dir, f"class_{class_idx}_weights.csv")
            df.to_csv(output_file, index=False)
