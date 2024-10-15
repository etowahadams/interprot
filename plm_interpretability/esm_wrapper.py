import torch
import torch.nn as nn 
import pytorch_lightning as pl
from esm.modules import ESM1bLayerNorm, RobertaLMHead, TransformerLayer

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
            if 'lm_head' in k:
                ckpt[k.replace('encoder.','')] = model_data[k]
            else:
                ckpt[k.replace('encoder.sentence_encoder.','')] = model_data[k]
        self.load_state_dict(ckpt)
        
    def compose_input(self, list_tuple_seq):
        _, _, batch_tokens = self.batch_converter(list_tuple_seq)
        batch_tokens = batch_tokens.to(self.device)
        return batch_tokens 
    
    def get_layer_activations(self, input, layer_idx):
        if isinstance(input, str):
            tokens = self.compose_input([('protein', input)])
        elif isinstance(input, list):
            tokens = self.compose_input([('protein', seq) for seq in input])
        else:
            tokens = input
            
        x = self.embed_scale * self.embed_tokens(tokens)
        x = x.transpose(0, 1) # (B, T, E) => (T, B, E)
        for _, layer in enumerate(self.layers[:layer_idx]):
            x, attn = layer(
                x,
                self_attn_padding_mask=None,
                need_head_weights=False,
            )
        return tokens, x.transpose(0, 1)
    
    def get_sequence(self, x, layer_idx):
        x = x.transpose(0, 1) # (B, T, E) => (T, B, E)
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