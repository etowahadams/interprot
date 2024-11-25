import esm
import pytorch_lightning as pl
import torch
import torch.nn.functional as F
import numpy as np
from functools import cache
from esm_wrapper import ESM2Model
from sae_model import SparseAutoencoder, loss_fn
from validation_metrics import diff_cross_entropy


@cache
def get_esm_model(d_model, alphabet, esm2_weight):
    esm2_model = ESM2Model(
            num_layers=33,
            embed_dim=d_model,
            attention_heads=20,
            alphabet=alphabet,
            token_dropout=False,
        )
    esm2_model.load_esm_ckpt(esm2_weight)
    esm2_model.eval()
    for param in esm2_model.parameters():
        param.requires_grad = False
    esm2_model.cuda()
    
    return esm2_model

class SAELightningModule(pl.LightningModule):
    def __init__(self, args):
        super().__init__()
        self.save_hyperparameters()
        self.args = args
        self.layer_to_use = args.layer_to_use
        self.sae_model = SparseAutoencoder(
            d_model=args.d_model,
            d_hidden=args.d_hidden,
            k=args.k,
            auxk=args.auxk,
            batch_size=args.batch_size,
            dead_steps_threshold=args.dead_steps_threshold,
        )
        self.alphabet = esm.data.Alphabet.from_architecture("ESM-1b")

    def forward(self, x):
        return self.sae_model(x)

    def training_step(self, batch, batch_idx):
        seqs = batch["Sequence"]
        batch_size = len(seqs)
        with torch.no_grad():
            esm2_model = get_esm_model(self.args.d_model, self.alphabet, self.args.esm2_weight)
            tokens, esm_layer_acts = esm2_model.get_layer_activations(seqs, self.layer_to_use)
        recons, auxk, num_dead = self(esm_layer_acts)
        mse_loss, auxk_loss = loss_fn(esm_layer_acts, recons, auxk)
        loss = mse_loss + auxk_loss
        self.log(
            "train_loss",
            loss,
            on_step=True,
            on_epoch=True,
            prog_bar=True,
            logger=True,
            batch_size=batch_size,
        )
        self.log(
            "train_mse_loss",
            mse_loss,
            on_step=True,
            on_epoch=True,
            logger=True,
            batch_size=batch_size,
        )
        self.log(
            "train_auxk_loss",
            auxk_loss,
            on_step=True,
            on_epoch=True,
            logger=True,
            batch_size=batch_size,
        )
        self.log(
            "num_dead_neurons",
            num_dead,
            on_step=True,
            on_epoch=True,
            logger=True,
            batch_size=batch_size,
        )
        return loss

    def validation_step(self, batch, batch_idx):
        seqs = batch["Sequence"]
        batch_size = len(seqs)
        with torch.no_grad():
            esm2_model = get_esm_model(self.args.d_model, self.alphabet, self.args.esm2_weight)

            diff_CE_all = []
            val_loss_all = []
            for seq in seqs:
                tokens, esm_layer_acts = esm2_model.get_layer_activations(seq, self.layer_to_use)
                recons, auxk, num_dead = self(esm_layer_acts)
                mse_loss, auxk_loss = loss_fn(esm_layer_acts, recons, auxk)
                loss = mse_loss + auxk_loss
                spliced_logits = esm2_model.get_sequence(recons, self.layer_to_use)
                orig_logits = esm2_model.get_sequence(esm_layer_acts, self.layer_to_use)
                diff_CE = diff_cross_entropy(orig_logits, spliced_logits, tokens)
                diff_CE_all.append(diff_CE)
                val_loss_all.append(loss)

        self.log(
            "diff_cross_entropy",
            np.mean(diff_CE_all),
            on_step=True,
            on_epoch=True,
            prog_bar=True,
            logger=True,
            batch_size=batch_size,
        )
        self.log(
            "val_loss",
            np.mean(val_loss_all),
            on_step=True,
            on_epoch=True,
            prog_bar=True,
            logger=True,
            batch_size=batch_size,
        )
        return loss

    def test_step(self, batch, batch_idx):
        return self.validation_step(batch, batch_idx)

    def configure_optimizers(self):
        return torch.optim.AdamW(self.parameters(), lr=self.args.lr)

    def on_after_backward(self):
        self.sae_model.norm_weights()
        self.sae_model.norm_grad()