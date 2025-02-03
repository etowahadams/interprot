# 1D logistic regression probes

For each latent, train a logistic regression classifier (2 parameters) to predict the presence of a given annotation.

## Single latent

```bash
oned_probe single-latent \
--sae-checkpoint interprot/checkpoints/l24_plm1280_sae4096_k128_100k.pt \
--sae-dim 4096 \
--plm-dim 1280 \
--plm-layer 24 \
--swissprot-tsv interprot/oned_probe/data/swissprot.tsv \
--output-dir interprot/oned_probe/results \
--max-seqs-per-task 5 \
--annotation-names "DNA binding"
```

## All latents

```bash
oned_probe all-latents \
--sae-checkpoint interprot/checkpoints/l24_plm1280_sae4096_k128_100k.pt \
--sae-dim 4096 \
--plm-dim 1280 \
--plm-layer 24 \
--swissprot-tsv interprot/oned_probe/data/swissprot.tsv \
--output-file interprot/oned_probe/results/all_latents.csv \
--max-seqs-per-task 5 \
--annotation-names "DNA binding"
```
