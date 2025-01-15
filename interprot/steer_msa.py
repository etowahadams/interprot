import os
import torch
import esm 
from Bio import SeqIO
from tqdm import tqdm 
from sae_model import SparseAutoencoder
from esm_wrapper import ESM2Model

D_MODEL = 1280
D_HIDDEN = 4096
dim_idx = 3260
threshold = 2.0
device = 'cuda:0'
multipliers = [0.5, 1.0, 2.0]

esm2_weight = os.path.join('/global/cfs/cdirs/m4351/ml5045/.cache/torch/hub/checkpoints/', 'esm2_t33_650M_UR50D.pt')
sae_weight = '/global/cfs/cdirs/m4351/ml5045/interp_weights/esm2_plm1280_l24_sae4096_100Kseqs.pt'
alphabet = esm.data.Alphabet.from_architecture("ESM-1b")

esm2_model = ESM2Model(num_layers=33, embed_dim=1280, attention_heads=20, 
                       alphabet=alphabet, token_dropout=False)
esm2_model.load_esm_ckpt(esm2_weight)
esm2_model.eval()
esm2_model = esm2_model.to(device)
sae_model = SparseAutoencoder(D_MODEL, D_HIDDEN)
sae_model.load_state_dict(torch.load(sae_weight))
sae_model.eval()
sae_model = sae_model.to(device)

fasta_file = "c1.fasta"
sequences = list(SeqIO.parse(fasta_file, "fasta"))
acts = []
steer_all = {k: [] for k in multipliers}
steer_part = {k: [] for k in multipliers}

all_acts = []
all_mus = []
all_stds = []
all_errs = []
max_acts = []
ids = []

for seq_record in tqdm(sequences, desc='Encoding..'):
    sequence = str(seq_record.seq)
    ids.append(seq_record.id)
    with torch.no_grad():
        tokens, embed = esm2_model.get_layer_activations(sequence, 24)
        acts, mu, std = sae_model.encode(embed[0])
        acts_dec = sae_model.decode(acts, mu, std)
        error = embed - acts_dec
        all_acts.append(acts)
        max_acts.append(acts.max())
        all_mus.append(mu)
        all_stds.append(std)
        all_errs.append(error)

max_act = max(max_acts)

for acts, mu, std, error in tqdm(zip(all_acts, all_mus, all_stds, all_errs), desc='Steering..', total=len(all_acts)):
    for mult_by in multipliers:
        acts[:, dim_idx] = max_act * mult_by
        steered_acts_dec = sae_model.decode(acts, mu, std)
        steered = esm2_model.get_sequence((error + steered_acts_dec), 24)
        steered_seq = torch.argmax(steered[0, 1:-1, 4:24], dim=-1)
        steered_seq = ''.join([alphabet.all_toks[i+4] for i in steered_seq])
        steer_all[mult_by].append(steered_seq)
        
        feat_dim = acts[:, dim_idx]
        acts[:, dim_idx] = feat_dim.masked_fill(feat_dim>=threshold, max_act * mult_by)
        steered_acts_dec = sae_model.decode(acts, mu, std)
        steered = esm2_model.get_sequence((error + steered_acts_dec), 24)
        steered_seq = torch.argmax(steered[0, 1:-1, 4:24], dim=-1)
        steered_seq = ''.join([alphabet.all_toks[i+4] for i in steered_seq])
        steer_part[mult_by].append(steered_seq)
    
for mult_by in multipliers:
    with open(f'c1_all_{mult_by}.fasta', 'w') as file:
        for i, s in zip(ids, steer_all[mult_by]):
            file.write(f'>{i}\n{s}\n')
    with open(f'c1_part_{mult_by}.fasta', 'w') as file:
        for i, s in zip(ids, steer_part[mult_by]):
            file.write(f'>{i}\n{s}\n')