import argparse
import glob
import os

import pytorch_lightning as pl
import wandb
from data_module import SequenceDataModule
from pytorch_lightning.callbacks import ModelCheckpoint
from pytorch_lightning.loggers import WandbLogger
from sae_module import SAELightningModule

parser = argparse.ArgumentParser()

parser.add_argument("--data-dir", type=str, default="data/uniref50_1M_1022.parquet")
parser.add_argument("--esm2-weight", type=str, default="weights/esm2_t33_650M_UR50D.pt")
parser.add_argument("-l", "--layer-to_use", type=int, default=24)
parser.add_argument("--d-model", type=int, default=1280)
parser.add_argument("--d-hidden", type=int, default=16384)
parser.add_argument("-b", "--batch-size", type=int, default=48)
parser.add_argument("--lr", type=float, default=2e-4)
parser.add_argument("--k", type=int, default=128)
parser.add_argument("--auxk", type=int, default=256)
parser.add_argument("--dead-steps-threshold", type=int, default=2000)
parser.add_argument("-e", "--max-epochs", type=int, default=1)
parser.add_argument("-d", "--num-devices", type=int, default=1)
parser.add_argument("--model-suffix", type=str, default="")
parser.add_argument("--wandb-project", type=str, default="interprot")
parser.add_argument("--num-workers", type=int, default=None)

args = parser.parse_args()
args.output_dir = (
    f"results_l{args.layer_to_use}_dim{args.d_hidden}_k{args.k}_auxk{args.auxk}_{args.model_suffix}"
)

if not os.path.exists(args.output_dir):
    os.mkdir(args.output_dir)

sae_name = (
    f"esm2_plm1280_l{args.layer_to_use}_sae{args.d_hidden}_"
    f"k{args.k}_auxk{args.auxk}_{args.model_suffix}"
)
wandb_logger = WandbLogger(
    project=args.wandb_project,
    name=sae_name,
    save_dir=os.path.join(args.output_dir, "wandb"),
)

model = SAELightningModule(args)
wandb_logger.watch(model, log="all")

data_module = SequenceDataModule(args.data_dir, args.batch_size, args.num_workers)
checkpoint_callback = ModelCheckpoint(
    dirpath=os.path.join(args.output_dir, "checkpoints"),
    filename=sae_name + "-{step}-{val_loss:.2f}",
    save_top_k=3,
    monitor="train_loss",
    mode="min",
    save_last=True,
)


trainer = pl.Trainer(
    max_epochs=args.max_epochs,
    accelerator="gpu",
    devices=list(range(args.num_devices)),
    strategy="auto",
    logger=wandb_logger,
    log_every_n_steps=10,
    val_check_interval=100,
    limit_val_batches=10,
    callbacks=[checkpoint_callback],
    gradient_clip_val=1.0,
)

trainer.fit(model, data_module)
trainer.test(model, data_module)

for checkpoint in glob.glob(os.path.join(args.output_dir, "checkpoints", "*.ckpt")):
    wandb.log_artifact(checkpoint, type="model")

wandb.finish()
