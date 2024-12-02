import polars as pl
from interprot.validation_metrics import calc_loss_recovered, diff_cross_entropy
from interprot.sae_module import get_esm_model
from interprot.sae_model import SparseAutoencoder
import matplotlib.pyplot as plt
import esm
import torch

def calc_avg_diff_CE(seqs, esm2_model, sae_model, layer):
    all_diffs = []
    for seq in seqs:
        tokens, esm_layer_acts = esm2_model.get_layer_activations(seq, layer)
        recons, auxk, num_dead = sae_model(esm_layer_acts)
        logits_recon = esm2_model.get_sequence(recons, layer)
        logits_orig = esm2_model.get_sequence(esm_layer_acts, layer)
        all_diffs.append(diff_cross_entropy(logits_orig, logits_recon, tokens))
    all_diffs_tensor = torch.tensor(all_diffs)
    return torch.mean(all_diffs_tensor).item()


def main():
    pLM_DIM = 1280
    SAE_DIM = 8192
    LAYER = 24
    device = 'cuda' if torch.cuda.is_available() else 'cpu'

    df = pl.read_parquet('swissprot_seqid30_75k_all_info.parquet')
    pl.set_random_seed(42)
    df = df.sample(n=100, with_replacement=False)
    seqs = df["Sequence"].to_list()

    # Model setup
    sae_model = SparseAutoencoder(pLM_DIM, SAE_DIM).to(device)
    alphabet = esm.data.Alphabet.from_architecture("ESM-1b")
    plm_weights = 'weights/esm2_t33_650M_UR50D.pt'
    esm2_model = get_esm_model(pLM_DIM, alphabet, plm_weights)
    
    sae_weights = ['results_l24_dim8192_k16/checkpoints/last.ckpt', 
                   'results_l24_dim8192_k32/checkpoints/last.ckpt', 
                   'results_l24_dim8192_k64/checkpoints/last.ckpt', 
                   'results_l24_dim8192_k128/checkpoints/last.ckpt', 
                   'results_l24_dim8192_k256/checkpoints/last.ckpt']

    all_diffs = []
    for i, sae_weight in enumerate(sae_weights):
        checkpoint = torch.load(sae_weight, map_location=torch.device(device))
        state_dict = checkpoint['state_dict']
        new_state_dict = {k.replace('sae_model.', ''): v for k, v in state_dict.items()}
        sae_model.load_state_dict(new_state_dict)
        avg_diff_CE = calc_avg_diff_CE(seqs, esm2_model, sae_model, LAYER)
        print(f'{sae_weight}, avg_diff_CE={avg_diff_CE}')
        all_diffs.append(avg_diff_CE)

    print(all_diffs)
    # save the figure as a PNG file
    plt.plot([16, 32, 64, 128, 256], all_diffs)
    plt.scatter([16, 32, 64, 128, 256], all_diffs, color='blue')
    plt.xlabel('Sparsity (L0)')
    plt.yscale('log')
    plt.xscale('log')
    plt.ylabel('Delta cross-entropy')
    plt.savefig('avg_diff_CE_plot.png')

if __name__ == '__main__':
    main()