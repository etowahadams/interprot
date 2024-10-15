import torch 
import polars as pr
import pytorch_lightning as pl
from torch.utils.data import Dataset
from utils import train_val_test_split 

class PolarsDataset(Dataset):
    def __init__(self, df):
        self.df = df

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.row(idx, named=True)
        return {"Sequence": row["Sequence"], "Entry": row["Entry"]}

# Data Module
class SequenceDataModule(pl.LightningDataModule):
    def __init__(self, data_path, batch_size):
        super().__init__()
        self.data_path = data_path
        self.batch_size = batch_size

    def setup(self, stage=None):
        df = pr.read_parquet(self.data_path)
        self.train_data, self.val_data, self.test_data = train_val_test_split(df)

    def train_dataloader(self):
        return torch.utils.data.DataLoader(PolarsDataset(self.train_data), batch_size=self.batch_size, shuffle=True)

    def val_dataloader(self):
        return torch.utils.data.DataLoader(PolarsDataset(self.val_data), batch_size=self.batch_size)

    def test_dataloader(self):
        return torch.utils.data.DataLoader(PolarsDataset(self.test_data), batch_size=self.batch_size)
