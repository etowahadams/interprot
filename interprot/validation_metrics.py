import torch
import torch.nn.functional as F

def diff_cross_entropy(orig_logits, recons_logits, tokens):
    """
    Calculates the difference in cross-entropy between two sets of logits.

    This function is used in the validation step of the SAE model.
    """
    orig_logits = orig_logits.view(-1, orig_logits.size(-1))
    recons_logits = recons_logits.view(-1, recons_logits.size(-1))
    tokens = tokens.view(-1)
    orig_loss = F.cross_entropy(orig_logits, tokens).mean().item()
    recons_loss = F.cross_entropy(recons_logits, tokens).mean().item()
    return recons_loss - orig_loss


def calc_diff_cross_entropy(seq, layer, esm2_model, sae_model):
    """
    Calculates the difference in cross-entropy when splicing in the SAE model.
    Wrapper around diff_cross_entropy.

    Args:
        seq: A string representing the sequence.
        layer: The layer of the ESM model to use.
        esm2_model: The ESM model.
        sae_model: The SAE model.
    
    Returns:
        float: The difference in cross-entropy.
    """
    tokens, esm_layer_acts = esm2_model.get_layer_activations(seq, layer)
    recons, auxk, num_dead = sae_model(esm_layer_acts)
    logits_recon = esm2_model.get_sequence(recons, layer)
    logits_orig = esm2_model.get_sequence(esm_layer_acts, layer)

    return diff_cross_entropy(logits_orig, logits_recon, tokens)


def calc_loss_recovered(seq, layer, esm2_model, sae_model):
    """
    Calculates the "loss recovered": 1- \frac{CE(recons) - CE(orig)}{CE(zeros) - CE(orig)}.
    Wrapper around diff_cross_entropy.

    Args:
        seq: A string representing the sequence.
        layer: The layer of the ESM model to use.
        esm2_model: The ESM model.
        sae_model: The SAE model.
    
    Returns:
        float: The loss recovered.
    """
    tokens, esm_layer_acts = esm2_model.get_layer_activations(seq, layer)
    recons, auxk, num_dead = sae_model(esm_layer_acts)
    logits_recon = esm2_model.get_sequence(recons, layer)
    logits_orig = esm2_model.get_sequence(esm_layer_acts, layer)
    
    zeros_act = torch.zeros_like(esm_layer_acts)
    logits_zeros = esm2_model.get_sequence(zeros_act, layer)

    diff_CE = diff_cross_entropy(logits_orig, logits_recon, tokens)
    diff_CE_zeros = diff_cross_entropy(logits_orig, logits_zeros, tokens)

    return 1 - (diff_CE / diff_CE_zeros)


