import json 
import pickle
from tqdm import tqdm
import pandas as pd
import ssl
from urllib import request
from urllib.error import HTTPError
from time import sleep

interpro_dir = '/pmglocal/ml5045/projects/msa-data/interpro.pkl'
family_data_dir = '/pmglocal/ml5045/projects/msa-data/family.parquet'
f1_cutoff = 0.8

df = pd.read_parquet(family_data_dir)
df = df[df.f1 > f1_cutoff]

def get_interpro_list(ipr):
    #disable SSL verification to avoid config issues
    context = ssl._create_unverified_context()
    accession_list = []
    next = f"https://www.ebi.ac.uk:443/interpro/api/protein/reviewed/entry/InterPro/{ipr}/?page_size=200"
    while next:
        try:
            req = request.Request(next, headers={"Accept": "application/json"})
            res = request.urlopen(req, context=context)
            # If the API times out due a long running query
            if res.status == 408:
                # wait just over a minute
                tqdm.write('waiting...')
                sleep(61)
                # then continue this loop with the same URL
                continue
            elif res.status == 204:
                #no data so leave loop
                break
            payload = json.loads(res.read().decode())
            next = payload["next"]
        except HTTPError as e:
            if e.code == 408:
                tqdm.write('waiting e...')
                sleep(61)
                continue
            else:
                raise e
        tqdm.write(f'processing: {len(payload["results"])}')
        for i, item in enumerate(payload["results"]):
            accession_list.append(item["metadata"]["accession"])
      
    # Don't overload the server, give it time before asking for more
    if next:
        sleep(1)
    
    return accession_list

classes = list(set(df['class'].tolist()))
print(len(classes))

interpro_dict = {}
for cls in tqdm(classes):
    ipr_list = get_interpro_list(ipr=cls)
    interpro_dict[cls] = ipr_list

with open(interpro_dir, 'wb') as file:
    pickle.dump(interpro_dict, file)