import esm
import torch 
import pytorch_lightning as pl
from esm_wrapper import ESM2Model
from sae_model import SparseAutoencoder, loss_fn
import torch.nn.functional as F

class SAELightningModule(pl.LightningModule):
    def __init__(self, args):
        super().__init__()
        self.save_hyperparameters()
        self.args = args
        self.layer_to_use = args.layer_to_use
        self.sae_model = SparseAutoencoder(args.d_model, args.d_hidden)
        self.alphabet = esm.data.Alphabet.from_architecture("ESM-1b")
        esm2_model = ESM2Model(num_layers=33, embed_dim=args.d_model, attention_heads=20, 
                       alphabet=self.alphabet, token_dropout=False)
        esm2_model.load_esm_ckpt(args.esm2_weight)
        self.esm2_model = esm2_model
        self.esm2_model.eval()
        for param in self.esm2_model.parameters():
            param.requires_grad = False
        
    def forward(self, x):
        return self.sae_model(x)

    def training_step(self, batch, batch_idx):
        seqs = batch["Sequence"]
        batch_size = len(seqs)
        with torch.no_grad():
            tokens, esm_layer_acts = self.esm2_model.get_layer_activations(seqs, self.layer_to_use)
        recons, auxk, num_dead = self(esm_layer_acts)
        mse_loss, auxk_loss = loss_fn(esm_layer_acts, recons, auxk)
        loss = mse_loss + auxk_loss
        self.log('train_loss', loss, on_step=True, on_epoch=True, prog_bar=True, logger=True, batch_size=batch_size)
        self.log('train_mse_loss', mse_loss, on_step=True, on_epoch=True, logger=True, batch_size=batch_size)
        self.log('train_auxk_loss', auxk_loss, on_step=True, on_epoch=True, logger=True, batch_size=batch_size)
        self.log('num_dead_neurons', num_dead, on_step=True, on_epoch=True, logger=True, batch_size=batch_size)
        return loss

    def validation_step(self, batch, batch_idx):
        seqs = batch["Sequence"]
        batch_size = len(seqs)
        with torch.no_grad():
            tokens, esm_layer_acts =  self.esm2_model.get_layer_activations(seqs, self.layer_to_use)
            recons, auxk, num_dead = self(esm_layer_acts)
            mse_loss, auxk_loss = loss_fn(esm_layer_acts, recons, auxk)
            loss = mse_loss + auxk_loss
            logits = self.esm2_model.get_sequence(recons, self.layer_to_use)
            logits = logits.view(-1, logits.size(-1))
            tokens = tokens.view(-1)
            correct = (torch.argmax(logits, dim=-1) == tokens).sum().item()
            total = tokens.size(0)
        
        self.log('val_celoss', F.cross_entropy(logits, tokens).mean().item(), on_step=True, on_epoch=True, prog_bar=True, logger=True, batch_size=batch_size)
        self.log('val_acc', correct / total, on_step=True, on_epoch=True, prog_bar=True, logger=True, batch_size=batch_size)
        self.log('val_loss', loss, on_step=True, on_epoch=True, prog_bar=True, logger=True, batch_size=batch_size)
        return loss

    def test_step(self, batch, batch_idx):
        return self.validation_step(batch, batch_idx)

    def configure_optimizers(self):
        return torch.optim.AdamW(self.parameters(), lr=self.args.lr)

    def on_after_backward(self):
        self.sae_model.norm_weights()
        self.sae_model.norm_grad()