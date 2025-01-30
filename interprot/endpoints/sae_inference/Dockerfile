FROM nvidia/cuda:11.8.0-base-ubuntu22.04

RUN echo "Building image for sae_inference endpoint"

RUN apt-get update && apt-get install -y \
    wget \
    python3-pip \
    python3-dev

COPY interprot/endpoints/sae_inference/requirements.txt .
RUN pip3 install -r requirements.txt

# Download ESM weights
RUN mkdir -p weights
WORKDIR /weights
RUN wget https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t33_650M_UR50D.pt

# Weights for esm2_plm1280_l24_sae4096_100Kseqs.pt
RUN gdown https://drive.google.com/uc?id=1LtDUfcWQEwPuTdd127HEb_A2jQdRyKrU
# # Weights for esm2_plm1280_l24_sae4096_k128_auxk512_antibody_seqs.ckpt
# RUN gdown https://drive.google.com/uc?id=19aCVCVLleTc4QSiXZsi5hPqrE21duk6q
# # Weights for esm2_plm1280_l4_sae4096_k64.ckpt
# RUN gdown https://drive.google.com/uc?id=1yrfhQ4Qtcpe2v9oeiBl4csklcnGbamNp
# # Weights for esm2_plm1280_l8_sae4096_k64_auxk640.ckpt
# RUN gdown https://drive.google.com/uc?id=1m30OvYHZmtdI8l6F1GsWr8TnZr_0Q_ax
# # Weights for esm2_plm1280_l12_sae4096_k64.ckpt
# RUN gdown https://drive.google.com/uc?id=1UA9Y6EV9cgY-HtNjz9n46DE4nUCJ8S1U
# # Weights for esm2_plm1280_l16_sae4096_k64_auxk640.ckpt
# RUN gdown https://drive.google.com/uc?id=1f_kHYqrV9qw-RKgQUBX-p5hDntwSkANd
# # Weights for esm2_plm1280_l20_sae4096_k64.ckpt
# RUN gdown https://drive.google.com/uc?id=1W_2sU3V4zTw0crG0fduKNdJpkk7CXgsd
# # Weights for esm2_plm1280_l24_sae4096_k64_auxk640.ckpt
# RUN gdown https://drive.google.com/uc?id=1QfcQLWBH5t2Bt975bbRNS33fUPGpaFJN
# # Weights for esm2_plm1280_l28_sae4096_k64.ckpt
# RUN gdown https://drive.google.com/uc?id=1wvyl0yb4kGbnlMYQsJpl7JSmNDLnoNpu
# # Weights for esm2_plm1280_l32_sae4096_k64.ckpt
# RUN gdown https://drive.google.com/uc?id=1LXwEnDsgLpyCILyTrQv_W2yTLwCV-6IP
# # Weights for esm2_plm1280_l33_sae4096_aux640.ckpt
# RUN gdown https://drive.google.com/uc?id=1Ly7IQjAp3UcPOgQLCgV6BQiwknV32VZU


WORKDIR /

# Bust cache by downloading a dynamic page: https://stackoverflow.com/a/55621942
# This ensures that any update to handler.py gets reflected
ADD https://google.com cache_bust
COPY interprot/endpoints/sae_inference/handler.py .

EXPOSE 8000

CMD ["/bin/bash", "-c", "python3 handler.py"]
