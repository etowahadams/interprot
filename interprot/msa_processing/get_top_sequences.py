import os
import json 
from tqdm import tqdm
import pandas as pd
import sys, errno, re, json, ssl
from urllib import request
from urllib.error import HTTPError
from time import sleep

json_dir = '/pmglocal/ml5045/projects/plm-interp-viz-data/esm2_plm1280_l24_sae4096_100Kseqs/'
family_data_dir = '/pmglocal/ml5045/projects/msa-data/family.parquet'
sequence_dir = '/pmglocal/ml5045/projects/msa-data/sequences'
f1_cutoff = 0.8

df = pd.read_parquet(family_data_dir)
df = df[df.f1 > f1_cutoff]

for i, row in tqdm(df.iterrows(), total=len(df)):
    file = os.path.join(json_dir, f"{row['dim']}.json")
    try: 
        with open(file, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file {file}")
        print(e)
        continue
    
    top_examples = data["ranges"]["0.75-1"]["examples"] # 1~12 sequences
    os.mkdir(os.path.join(sequence_dir, f"{row['dim']}_{row['class']}"))
    
    for i, ex in enumerate(top_examples):
        with open(os.path.join(sequence_dir, f"{row['dim']}_{row['class']}", f'{i}.fasta'), 'w') as file:
            file.write(f">{ex['name']} | {ex['uniprot_id']}\n")
            file.write(ex['sequence'])