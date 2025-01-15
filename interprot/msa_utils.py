import numpy as np
from Bio import SeqIO

sym_to_mask = {
    '*': 1,
    ' ': 0,
    '.': 2,
    ':': 3
}

def get_consensus_from_output(output_file, mask_file):
    align = []
    with open(output_file, 'r') as file:
        for line in file.readlines():
            if line.startswith("       "):
                align.append(line[25:].replace('\n',''))
    consensus = ''.join(align)
    consensus_mask = [sym_to_mask[i] for i in consensus]
    np.save(mask_file, np.array(consensus_mask))

def align_mutant_to_fasta(aligned_fasta, mutant_fasta, output_fasta):
    aligned_sequences = {record.id: str(record.seq) for record in SeqIO.parse(aligned_fasta, "fasta")}
    mutant_sequences = {record.id: str(record.seq) for record in SeqIO.parse(mutant_fasta, "fasta")}

    aligned_mutant_records = []
    for mutant_id, mutant_seq in mutant_sequences.items():
        assert mutant_id in aligned_sequences
    
    for mutant_id, mutant_seq in mutant_sequences.items():
        aligned_seq = aligned_sequences[mutant_id]
        aligned_mutant_seq = []
        mutant_index = 0

        # Insert gaps to align mutant sequence
        for char in aligned_seq:
            if char == "-":
                aligned_mutant_seq.append("-")
            else:
                aligned_mutant_seq.append(mutant_seq[mutant_index])
                mutant_index += 1

        # Create a new SeqRecord for the aligned mutant sequence
        aligned_mutant_seq = "".join(aligned_mutant_seq)
        aligned_mutant_records.append(SeqIO.SeqRecord(
            id=mutant_id,
            seq=aligned_mutant_seq,
            description=""
        ))

    with open(output_fasta, "w") as output_handle:
        SeqIO.write(aligned_mutant_records, output_handle, "fasta")


get_consensus_from_output('c1_output', 'mask')

aligned_fasta_path = "c1_aligned.fasta"
mutant_fasta_path = "c1_all_2.0.fasta"
output_fasta_path = "c1_all_2.0_aligned.fasta"
align_mutant_to_fasta(aligned_fasta_path, mutant_fasta_path, output_fasta_path)