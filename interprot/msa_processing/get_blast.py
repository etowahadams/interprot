import xml.etree.ElementTree as ET
from tqdm import tqdm
import glob
import os
import subprocess
from multiprocessing import Pool, cpu_count

def blast_and_convert_single(seq_file):
    try:
        # Define corresponding output paths
        relative_path = os.path.relpath(seq_file, start="/pmglocal/ml5045/projects/msa-data/sequences")
        blast_output_dir = os.path.join("/pmglocal/ml5045/projects/msa-data/blast", os.path.dirname(relative_path))
        blast_output_file = os.path.join(blast_output_dir, os.path.basename(seq_file).replace('.fasta', '.out'))
        
        # Run BLASTP command
        blast_command = [
            "blastp",
            "-db", "/pmglocal/ml5045/projects/msa-data/ncbi-blast-2.16.0+/bin/swissprot",
            "-query", seq_file,
            "-out", blast_output_file,
            "-max_target_seqs", "100",
            "-outfmt", "5"
        ]
        print(f"Running BLASTP for {seq_file}...")
        subprocess.run(blast_command, check=True)

        # Convert BLAST XML output to FASTA
        fasta_output_file = os.path.join(blast_output_dir, os.path.basename(seq_file))
        xml_to_fasta(blast_output_file, fasta_output_file)
    except Exception as e:
        print(f"Error processing {seq_file}: {e}")


def xml_to_fasta(xml_file, fasta_file):
    # Parse the XML file
    tree = ET.parse(xml_file)
    root = tree.getroot()

    # Open the output FASTA file
    with open(fasta_file, "w") as fasta:
        # Navigate through the XML structure
        for hit in root.findall(".//Hit"):
            accession = hit.find("Hit_accession").text
            hsp_hseq = hit.find(".//Hsp_hseq").text
            hsp_hseq = hsp_hseq.replace("-", "")

            fasta.write(f">{accession}\n")
            fasta.write(f"{hsp_hseq}\n")


def run_blast_and_convert():
    os.mkdir('/pmglocal/ml5045/projects/msa-data/blast')
    for d in os.listdir('/pmglocal/ml5045/projects/msa-data/sequences'):
        os.mkdir(os.path.join('/pmglocal/ml5045/projects/msa-data/blast', d))
    
    # Get all FASTA files in sequences/*/*.fasta
    sequence_files = glob.glob("/pmglocal/ml5045/projects/msa-data/sequences/*/*.fasta")

    # Use multiprocessing Pool to parallelize the task
    num_processes = 32
    print(f"Using {num_processes} processes for parallel BLASTP execution.")

    with Pool(processes=num_processes) as pool:
        list(tqdm(pool.imap_unordered(blast_and_convert_single, sequence_files), total=len(sequence_files)))

    print("All BLASTP executions and conversions completed.")


if __name__ == "__main__":
    # Run BLASTP and convert XML to FASTA
    run_blast_and_convert()