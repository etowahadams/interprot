import os
import torch
import wandb
import argparse
import pytorch_lightning as pl
from pytorch_lightning.loggers import WandbLogger
from pytorch_lightning.callbacks import ModelCheckpoint
from sae_module import SAELightningModule 
from data_module import SequenceDataModule

os.environ["WANDB_CACHE_DIR"] = '/global/cfs/cdirs/m4351/ml5045/wandb'
parser = argparse.ArgumentParser()

parser.add_argument('--output-dir', type=str, required=True)
parser.add_argument('--data-dir', type=str, required=True)
parser.add_argument('--esm2-weight', type=str, default='/global/cfs/cdirs/m4351/ml5045/interp_weights/esm2_t33_650M_UR50D.pt')
parser.add_argument('-l', '--layer-to_use', type=int, default=24)
parser.add_argument('--d-model', type=int, default=1280)
parser.add_argument('--d-hidden', type=int, default=32768)
parser.add_argument('-b', '--batch-size', type=int, default=64)
parser.add_argument('--lr', type=float, default=2e-3)
parser.add_argument('--k', type=int, default=128)
parser.add_argument('--auxk', type=int, default=256)
parser.add_argument('--dead-steps-threshold', type=int, default=2000)
parser.add_argument('-e', '--max-epochs', type=int, default=1)
parser.add_argument('-d', '--num-devices', type=int, default=1)

args = parser.parse_args()

if not os.path.exists(args.output_dir):
    os.mkdir(args.output_dir)
    
wandb_logger = WandbLogger(project="interpretability_test", 
                           name="sae_opt",
                           save_dir=os.path.join(args.output_dir, 'wandb'))

# Initialize model and data module
model = SAELightningModule(args)
data_module = SequenceDataModule(args.data_dir, args.batch_size)

# Set up callbacks
checkpoint_callback = ModelCheckpoint(
    dirpath=os.path.join(args.output_dir, 'checkpoints'),
    filename='sae-{step}-{val_loss:.2f}',
    save_top_k=3,
    monitor='val_loss',
    mode='min',
    save_last=True
)

# Initialize Trainer
trainer = pl.Trainer(
    max_epochs=args.max_epochs,
    accelerator='gpu',
    devices=list(range(args.num_devices)),
    strategy='ddp' if args.num_devices > 1 else 'auto',
    logger=wandb_logger,
    log_every_n_steps=10,
    val_check_interval=10,
    callbacks=[checkpoint_callback],
    gradient_clip_val=1.0,
)

# Train the model
trainer.fit(model, data_module)

# Test the model
trainer.test(model, data_module)

# Close WandB run
wandb.finish()