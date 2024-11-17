export function redColorMapRGB(value: number, maxValue: number) {
  // Ensure value is between 0 and maxValue
  value = Math.max(0, Math.min(value, maxValue));

  // Normalize value between 0 and 1
  const normalized = value / maxValue;

  // Interpolate between white (255, 255, 255) and red (255, 0, 0)
  const red = 255;
  const green = Math.round(255 * (1 - normalized));
  const blue = Math.round(255 * (1 - normalized));
  return [red, green, blue];
}

export function redColorMapHex(value: number, maxValue: number) {
  const [red, green, blue] = redColorMapRGB(value, maxValue);
  return `rgb(${red}, ${green}, ${blue})`;
}

const token_dict: { [key: number]: string } = {
  4: "L",
  5: "A",
  6: "G",
  7: "V",
  8: "S",
  9: "E",
  10: "R",
  11: "T",
  12: "I",
  13: "D",
  14: "P",
  15: "K",
  16: "Q",
  17: "N",
  18: "F",
  19: "Y",
  20: "M",
  21: "H",
  22: "W",
  23: "C",
  24: "X",
  25: "B",
  26: "U",
  27: "Z",
  28: "O",
  29: ".",
  30: "-",
};

const residue_dict: { [key: string]: number } = {};
for (const [key, value] of Object.entries(token_dict)) {
  residue_dict[value] = Number(key);
}

export function tokenToResidue(token: number): string {
  return token_dict[token];
}

export function residueToToken(residue: string): number {
  return residue_dict[residue];
}

export function tokensToSequence(tokens: Array<number>): string {
  return tokens.map((token) => tokenToResidue(token)).join("");
}

export function sequenceToTokens(sequence: string): Array<number> {
  return sequence.split("").map((residue) => residueToToken(residue));
}

// Cache for sequence -> structure data in PDB format
export const StructureCache: Record<string, string> = {};

export type ProteinSequence = string & { readonly __brand: unique symbol };

export const isProteinSequence = (sequence: string): sequence is ProteinSequence => {
  const validAminoAcids = /^[ACDEFGHIKLMNPQRSTVWYBUXZ]+$/i;
  return validAminoAcids.test(sequence.trim());
};

// A special string type requiring passing the isPDBID type guard
export type PDBID = string & { readonly __brand: unique symbol };

export const isPDBID = (input: string): input is PDBID => {
  const pdbPattern = /^[0-9A-Z]{4}$/i;
  return pdbPattern.test(input.trim());
};

export type PDBSeqData = {
  name: string;
  chainId: string;
  sequence: ProteinSequence;
};

interface PolymerEntity {
  entity_poly: {
    pdbx_seq_one_letter_code_can: string;
  };
  rcsb_polymer_entity: {
    pdbx_description: string;
  };
  polymer_entity_instances: Array<{
    rcsb_polymer_entity_instance_container_identifiers: {
      auth_asym_id: string;
    };
  }>;
}

/**
 * Fetches the sequences of a given PDB ID. There may be multiple sequences for proteins with
 * multiple chains.
 */
export const getPDBSeqsData = async (pdbId: PDBID): Promise<PDBSeqData[]> => {
  const query = `
    query GetFastaSequence($pdbId: String!) {
      entry(entry_id: $pdbId) {
        polymer_entities {
          rcsb_polymer_entity {
            pdbx_description
          }
          entity_poly {
            pdbx_seq_one_letter_code_can
            rcsb_sample_sequence_length
          }
          polymer_entity_instances {
            rcsb_polymer_entity_instance_container_identifiers {
              auth_asym_id
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://data.rcsb.org/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { pdbId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDB sequence: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.data?.entry?.polymer_entities) {
    throw new Error("Invalid PDB ID or unexpected API response");
  }

  return data.data.entry.polymer_entities.flatMap((entity: PolymerEntity) => {
    const sequence = entity.entity_poly.pdbx_seq_one_letter_code_can as ProteinSequence;
    const name = entity.rcsb_polymer_entity.pdbx_description || "";

    return entity.polymer_entity_instances.map(
      (instance: PolymerEntity["polymer_entity_instances"][0]) => {
        const chainId = instance.rcsb_polymer_entity_instance_container_identifiers.auth_asym_id;
        return {
          name,
          chainId,
          sequence,
        };
      }
    );
  });
};
