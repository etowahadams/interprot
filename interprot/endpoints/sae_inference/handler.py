"""
Note(Liam): I wanted to keep the dependencies as simple as possible so copied some
code like `SparseAutoencoder`. Ideally I think we publish all the SAE stuff as a
package to pypi and add it as a dependency.
"""

import logging
import math
import os
import re
import traceback

import esm
import pytorch_lightning as pl
import runpod
import torch
import torch.nn as nn
from esm.modules import ESM1bLayerNorm, RobertaLMHead, TransformerLayer
from torch.nn import functional as F

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WEIGHTS_DIR = "/weights"
SAE_NAME_TO_CHECKPOINT = {
    "SAE4096-L24": "esm2_plm1280_l24_sae4096_100Kseqs.pt",
    # "SAE4096-L24-ab": "esm2_plm1280_l24_sae4096_k128_auxk512_antibody_seqs.ckpt",
    # "SAE4096-L4": "esm2_plm1280_l4_sae4096_k64.ckpt",
    # "SAE4096-L8": "esm2_plm1280_l8_sae4096_k64_auxk640.ckpt",
    # "SAE4096-L12": "esm2_plm1280_l12_sae4096_k64.ckpt",
    # "SAE4096-L16": "esm2_plm1280_l16_sae4096_k64_auxk640.ckpt",
    # "SAE4096-L20": "esm2_plm1280_l20_sae4096_k64.ckpt",
    # "SAE4096-L24-v2": "esm2_plm1280_l24_sae4096_k64_auxk640.ckpt",
    # "SAE4096-L28": "esm2_plm1280_l28_sae4096_k64.ckpt",
    # "SAE4096-L32": "esm2_plm1280_l32_sae4096_k64.ckpt",
    # "SAE4096-L33": "esm2_plm1280_l33_sae4096_aux640.ckpt",
}


class SparseAutoencoder(nn.Module):
    def __init__(
        self,
        d_model: int,
        d_hidden: int,
        k: int = 128,
        auxk: int = 256,
        batch_size: int = 256,
        dead_steps_threshold: int = 2000,
    ):
        """
        Initialize the Sparse Autoencoder.

        Args:
            d_model: Dimension of the pLM model.
            d_hidden: Dimension of the SAE hidden layer.
            k: Number of top-k activations to keep.
            auxk: Number of auxiliary activations.
            dead_steps_threshold: How many examples of inactivation before we consider
                a hidden dim dead.

        Adapted from https://github.com/tylercosgrove/sparse-autoencoder-mistral7b/blob/main/sae.py
        based on 'Scaling and evaluating sparse autoencoders' (Gao et al. 2024) https://arxiv.org/pdf/2406.04093
        """
        super().__init__()

        self.w_enc = nn.Parameter(torch.empty(d_model, d_hidden))
        self.w_dec = nn.Parameter(torch.empty(d_hidden, d_model))

        self.b_enc = nn.Parameter(torch.zeros(d_hidden))
        self.b_pre = nn.Parameter(torch.zeros(d_model))

        self.d_model = d_model
        self.d_hidden = d_hidden
        self.k = k
        self.auxk = auxk
        self.batch_size = batch_size

        self.dead_steps_threshold = dead_steps_threshold / batch_size

        # TODO: Revisit to see if this is the best way to initialize
        nn.init.kaiming_uniform_(self.w_enc, a=math.sqrt(5))
        self.w_dec.data = self.w_enc.data.T.clone()
        self.w_dec.data /= self.w_dec.data.norm(dim=0)

        # Initialize dead neuron tracking. For each hidden dimension, save the
        # index of the example at which it was last activated.
        self.register_buffer("stats_last_nonzero", torch.zeros(d_hidden, dtype=torch.long))

    def topK_activation(self, x: torch.Tensor, k: int) -> torch.Tensor:
        """
        Apply top-k activation to the input tensor.

        Args:
            x: (BATCH_SIZE, D_EMBED, D_MODEL) input tensor to apply top-k activation on.
            k: Number of top activations to keep.

        Returns:
            torch.Tensor: Tensor with only the top k activations preserved,and others
            set to zero.

        This function performs the following steps:
        1. Find the top k values and their indices in the input tensor.
        2. Apply ReLU activation to these top k values.
        3. Create a new tensor of zeros with the same shape as the input.
        4. Scatter the activated top k values back into their original positions.
        """
        topk = torch.topk(x, k=k, dim=-1, sorted=False)
        values = F.relu(topk.values)
        result = torch.zeros_like(x)
        result.scatter_(-1, topk.indices, values)
        return result

    def LN(
        self, x: torch.Tensor, eps: float = 1e-5
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Apply Layer Normalization to the input tensor.

        Args:
            x: Input tensor to be normalized.
            eps: A small value added to the denominator for numerical stability.

        Returns:
            tuple[torch.Tensor, torch.Tensor, torch.Tensor]: A tuple containing:
                - The normalized tensor.
                - The mean of the input tensor.
                - The standard deviation of the input tensor.

        TODO: Is eps = 1e-5 the best value?
        """
        mu = x.mean(dim=-1, keepdim=True)
        x = x - mu
        std = x.std(dim=-1, keepdim=True)
        x = x / (std + eps)
        return x, mu, std

    def auxk_mask_fn(self) -> torch.Tensor:
        """
        Create a mask for dead neurons.

        Returns:
            torch.Tensor: A boolean tensor of shape (D_HIDDEN,) where True indicates
                a dead neuron.
        """
        dead_mask = self.stats_last_nonzero > self.dead_steps_threshold
        return dead_mask

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass of the Sparse Autoencoder. If there are dead neurons, compute the
        reconstruction using the AUXK auxiliary hidden dims as well.

        Args:
            x: (BATCH_SIZE, D_EMBED, D_MODEL) input tensor to the SAE.

        Returns:
            tuple[torch.Tensor, torch.Tensor, torch.Tensor]: A tuple containing:
                - The reconstructed activations via top K hidden dims.
                - If there are dead neurons, the auxiliary activations via top AUXK
                    hidden dims; otherwise, None.
                - The number of dead neurons.
        """
        x, mu, std = self.LN(x)
        x = x - self.b_pre

        pre_acts = x @ self.w_enc + self.b_enc

        # latents: (BATCH_SIZE, D_EMBED, D_HIDDEN)
        latents = self.topK_activation(pre_acts, k=self.k)

        # `(latents == 0)` creates a boolean tensor element-wise from `latents`.
        # `.all(dim=(0, 1))` preserves D_HIDDEN and does the boolean `all`
        # operation across BATCH_SIZE and D_EMBED. Finally, `.long()` turns
        # it into a vector of 0s and 1s of length D_HIDDEN.
        #
        # self.stats_last_nonzero is a vector of length D_HIDDEN. Doing
        # `*=` with `M = (latents == 0).all(dim=(0, 1)).long()` has the effect
        # of: if M[i] = 0, self.stats_last_nonzero[i] is cleared to 0, and then
        # immediately incremented; if M[i] = 1, self.stats_last_nonzero[i] is
        # unchanged. self.stats_last_nonzero[i] means "for how many consecutive
        # iterations has hidden dim i been zero".
        self.stats_last_nonzero *= (latents == 0).all(dim=(0, 1)).long()
        self.stats_last_nonzero += 1

        dead_mask = self.auxk_mask_fn()
        num_dead = dead_mask.sum().item()

        recons = latents @ self.w_dec + self.b_pre
        recons = recons * std + mu

        if num_dead > 0:
            k_aux = min(x.shape[-1] // 2, num_dead)

            auxk_latents = torch.where(dead_mask[None], pre_acts, -torch.inf)
            auxk_acts = self.topK_activation(auxk_latents, k=k_aux)

            auxk = auxk_acts @ self.w_dec + self.b_pre
            auxk = auxk * std + mu
        else:
            auxk = None

        return recons, auxk, num_dead

    @torch.no_grad()
    def forward_val(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass of the Sparse Autoencoder for validation.

        Args:
            x: (BATCH_SIZE, D_EMBED, D_MODEL) input tensor to the SAE.

        Returns:
            torch.Tensor: The reconstructed activations via top K hidden dims.
        """
        x, mu, std = self.LN(x)
        x = x - self.b_pre
        pre_acts = x @ self.w_enc + self.b_enc
        latents = self.topK_activation(pre_acts, self.k)

        recons = latents @ self.w_dec + self.b_pre
        recons = recons * std + mu
        return recons

    @torch.no_grad()
    def norm_weights(self) -> None:
        """
        Normalize the weights of the Sparse Autoencoder.
        """
        self.w_dec.data /= self.w_dec.data.norm(dim=0)

    @torch.no_grad()
    def norm_grad(self) -> None:
        """
        Normalize the gradient of the weights of the Sparse Autoencoder.
        """
        dot_products = torch.sum(self.w_dec.data * self.w_dec.grad, dim=0)
        self.w_dec.grad.sub_(self.w_dec.data * dot_products.unsqueeze(0))

    @torch.no_grad()
    def get_acts(self, x: torch.Tensor) -> torch.Tensor:
        """
        Get the activations of the Sparse Autoencoder.

        Args:
            x: (BATCH_SIZE, D_EMBED, D_MODEL) input tensor to the SAE.

        Returns:
            torch.Tensor: The activations of the Sparse Autoencoder.
        """
        x, _, _ = self.LN(x)
        x = x - self.b_pre
        pre_acts = x @ self.w_enc + self.b_enc
        latents = self.topK_activation(pre_acts, self.k)
        return latents

    @torch.no_grad()
    def encode(self, x: torch.Tensor) -> torch.Tensor:
        x, mu, std = self.LN(x)
        x = x - self.b_pre
        acts = x @ self.w_enc + self.b_enc
        return acts, mu, std

    @torch.no_grad()
    def decode(self, acts: torch.Tensor, mu: torch.Tensor, std: torch.Tensor) -> torch.Tensor:
        latents = self.topK_activation(acts, self.k)

        recons = latents @ self.w_dec + self.b_pre
        recons = recons * std + mu
        return recons


class ESM2Model(pl.LightningModule):
    def __init__(self, num_layers, embed_dim, attention_heads, alphabet, token_dropout):
        super().__init__()
        self.num_layers = num_layers
        self.embed_dim = embed_dim
        self.attention_heads = attention_heads
        self.alphabet = alphabet
        self.alphabet_size = len(alphabet)
        self.batch_converter = self.alphabet.get_batch_converter()
        self.padding_idx = alphabet.padding_idx
        self.mask_idx = alphabet.mask_idx
        self.cls_idx = alphabet.cls_idx
        self.eos_idx = alphabet.eos_idx
        self.prepend_bos = alphabet.prepend_bos
        self.append_eos = alphabet.append_eos
        self.token_dropout = token_dropout
        self._init_submodules()

    def _init_submodules(self):
        self.embed_scale = 1
        self.embed_tokens = nn.Embedding(
            self.alphabet_size,
            self.embed_dim,
            padding_idx=self.padding_idx,
        )

        self.layers = nn.ModuleList(
            [
                TransformerLayer(
                    self.embed_dim,
                    4 * self.embed_dim,
                    self.attention_heads,
                    add_bias_kv=False,
                    use_esm1b_layer_norm=True,
                    use_rotary_embeddings=True,
                )
                for _ in range(self.num_layers)
            ]
        )

        self.emb_layer_norm_after = ESM1bLayerNorm(self.embed_dim)

        self.lm_head = RobertaLMHead(
            embed_dim=self.embed_dim,
            output_dim=self.alphabet_size,
            weight=self.embed_tokens.weight,
        )

    def load_esm_ckpt(self, esm_pretrained):
        ckpt = {}
        model_data = torch.load(esm_pretrained)["model"]
        for k in model_data:
            if "lm_head" in k:
                ckpt[k.replace("encoder.", "")] = model_data[k]
            else:
                ckpt[k.replace("encoder.sentence_encoder.", "")] = model_data[k]
        self.load_state_dict(ckpt)

    def compose_input(self, list_tuple_seq):
        _, _, batch_tokens = self.batch_converter(list_tuple_seq)
        batch_tokens = batch_tokens.to(self.device)
        return batch_tokens

    def get_layer_activations(self, input, layer_idx):
        if isinstance(input, str):
            tokens = self.compose_input([("protein", input)])
        elif isinstance(input, list):
            tokens = self.compose_input([("protein", seq) for seq in input])
        else:
            tokens = input

        x = self.embed_scale * self.embed_tokens(tokens)
        x = x.transpose(0, 1)  # (B, T, E) => (T, B, E)
        for _, layer in enumerate(self.layers[:layer_idx]):
            x, attn = layer(
                x,
                self_attn_padding_mask=None,
                need_head_weights=False,
            )
        return tokens, x.transpose(0, 1)

    def get_sequence(self, x, layer_idx):
        x = x.transpose(0, 1)  # (B, T, E) => (T, B, E)
        for _, layer in enumerate(self.layers[layer_idx:]):
            x, attn = layer(
                x,
                self_attn_padding_mask=None,
                need_head_weights=False,
            )
        x = self.emb_layer_norm_after(x)
        x = x.transpose(0, 1)  # (T, B, E) => (B, T, E)
        logits = self.lm_head(x)
        return logits


def load_models():
    sea_name_to_info = {}
    for sae_name, sae_checkpoint in SAE_NAME_TO_CHECKPOINT.items():
        pattern = r"plm(\d+).*?l(\d+).*?sae(\d+)"
        matches = re.search(pattern, sae_checkpoint)
        if matches:
            plm_dim, plm_layer, sae_dim = map(int, matches.groups())
        else:
            raise ValueError("Checkpoint file must start with plm<n>_l<n>_sae<n>")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load ESM2 model
        logger.info(f"Loading ESM2 model with plm_dim={plm_dim}")
        alphabet = esm.data.Alphabet.from_architecture("ESM-1b")
        esm2_model = ESM2Model(
            num_layers=33,
            embed_dim=plm_dim,
            attention_heads=20,
            alphabet=alphabet,
            token_dropout=False,
        )
        esm2_weights = os.path.join(WEIGHTS_DIR, "esm2_t33_650M_UR50D.pt")
        esm2_model.load_esm_ckpt(esm2_weights)
        esm2_model = esm2_model.to(device)

        # Load SAE models
        logger.info(f"Loading SAE model {sae_name}")
        sae_model = SparseAutoencoder(plm_dim, sae_dim).to(device)
        sae_weights = os.path.join(WEIGHTS_DIR, sae_checkpoint)

        try:
            sae_model.load_state_dict(torch.load(sae_weights, weights_only=False))
        except Exception:
            try:
                checkpoint = torch.load(sae_weights, weights_only=False)
                sae_model.load_state_dict(
                    {k.replace("sae_model.", ""): v for k, v in checkpoint["state_dict"].items()}
                )
            except Exception as e:
                logger.error(f"Failed to load SAE weights: {str(e)}")
                raise

        sea_name_to_info[sae_name] = {
            "model": sae_model,
            "plm_layer": plm_layer,
        }

    logger.info("Models loaded successfully")
    return esm2_model, sea_name_to_info


def handler(event):
    logger.info(f"starting handler with event: {event}")
    try:
        input_data = event["input"]
        seq = input_data["sequence"]
        sae_name = input_data["sae_name"]
        dim = input_data.get("dim")
        sae_info = sea_name_to_info[sae_name]
        sae_model = sae_info["model"]
        plm_layer = sae_info["plm_layer"]
        logger.info(f"sae_name: {sae_name}, plm_layer: {plm_layer}, dim: {dim}")

        _, esm_layer_acts = esm2_model.get_layer_activations(seq, plm_layer)
        esm_layer_acts = esm_layer_acts[0].float()

        sae_acts = sae_model.get_acts(esm_layer_acts)[1:-1]

        data = {}
        if dim is not None:
            sae_dim_acts = sae_acts[:, dim].cpu().numpy()
            data["tokens_acts_list"] = [round(float(act), 1) for act in sae_dim_acts]
        else:
            max_acts, _ = torch.max(sae_acts, dim=0)
            sorted_dims = torch.argsort(max_acts, descending=True)
            active_dims = sorted_dims[max_acts[sorted_dims] > 0]
            sae_acts_by_active_dim = sae_acts[:, active_dims].cpu().numpy()

            data["token_acts_list_by_active_dim"] = [
                {
                    "dim": int(active_dims[dim_idx].item()),
                    "sae_acts": [
                        round(float(act), 1) for act in sae_acts_by_active_dim[:, dim_idx]
                    ],
                }
                for dim_idx in range(sae_acts_by_active_dim.shape[1])
            ]

        return {
            "status": "success",
            "data": data,
        }
    except Exception as e:
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"status": "error", "error": str(e)}


esm2_model, sea_name_to_info = load_models()
runpod.serverless.start({"handler": handler})
