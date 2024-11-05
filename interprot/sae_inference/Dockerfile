FROM nvidia/cuda:11.8.0-base-ubuntu22.04

RUN apt-get update && apt-get install -y \
    wget \
    python3-pip \
    python3-dev

COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Download ESM and SAE weights
RUN mkdir -p weights
WORKDIR /weights
RUN wget https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t33_650M_UR50D.pt
RUN gdown https://drive.google.com/uc?id=1LtDUfcWQEwPuTdd127HEb_A2jQdRyKrU
WORKDIR /

RUN echo 'hi'
COPY handler.py .

EXPOSE 8000

CMD ["/bin/bash", "-c", "python3 handler.py"]
