import { getSAEDimActivations } from "./modal";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import {
  ElementIndex,
  Model,
  Structure,
  StructureElement,
  Unit,
} from "molstar/lib/mol-model/structure";
import { OrderedSet } from "molstar/lib/mol-data/int";
import { Color } from "molstar/lib/mol-util/color";

/**
 * Creates a Molstar plugin spec with common configuration:
 * - Axes disabled
 * - Transparent background
 */
export function createMolstarSpec() {
  const spec = DefaultPluginSpec();
  spec.canvas3d = {
    camera: {
      helper: {
        axes: { name: "off", params: {} },
      },
    },
    transparentBackground: true,
  };
  return spec;
}

/**
 * Parses Molstar's HTML label and extracts just the residue identity.
 * Input example: "C-X-C motif chemokine 16</br><small>AF-Q29RT9-F1</small> | <small>Model 1</small> | <small>Instance 1_555</small> | <b>A</b> | <b>LEU 13</b><b></b>"
 * Output example: "LEU 13" or "LEU 13 (Chain A)" if showChain is true
 */
export function parseMolstarLabel(htmlLabel: string, showChain: boolean = false): string {
  // Extract chain ID - look for pattern like <b>A</b> where A is a single letter or short string
  const chainMatch = htmlLabel.match(/<b>([A-Za-z0-9]{1,3})<\/b>\s*\|\s*<b>([A-Z]{3}\s*\d+)<\/b>/);
  if (chainMatch) {
    const chain = chainMatch[1];
    const residue = chainMatch[2];
    return showChain ? `${residue} (Chain ${chain})` : residue;
  }

  // Fallback: just extract the last <b>RESIDUE NUM</b> pattern
  const residueMatch = htmlLabel.match(/<b>([A-Z]{3}\s*\d+)<\/b>/);
  if (residueMatch) {
    return residueMatch[1];
  }

  // Last resort: strip all HTML tags
  return htmlLabel.replace(/<[^>]*>/g, "").trim();
}

export function parseResidueIndexFromLabel(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)/);
  if (!match) return null;
  const residueNumber = Number(match[1]);
  return Number.isNaN(residueNumber) ? null : residueNumber - 1;
}

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

export function createResidueColorTheme(activationList: number[], name = "residue-colors") {
  const maxValue = Math.max(...activationList);
  return CustomElementProperty.create({
    label: "Residue Colors",
    name,
    getData(model: Model) {
      const map = new Map<ElementIndex, number>();
      const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
      for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
        map.set(i as ElementIndex, residueIndex[i]);
      }
      return { value: map };
    },
    coloring: {
      getColor(e) {
        const color = maxValue > 0 ? redColorMapRGB(activationList[e], maxValue) : [255, 255, 255];
        return activationList[e] !== undefined
          ? Color.fromRgb(color[0], color[1], color[2])
          : Color.fromRgb(255, 255, 255);
      },
      defaultColor: Color(0x777777),
    },
    getLabel() {
      return "Activation colors";
    },
  });
}

export function buildResidueIndexMap(structure: Structure) {
  const map = new Map<number, number>();
  const model = structure.models[0];
  if (!model) return map;

  const residues = model.atomicHierarchy.residues;
  const labelSeqId = residues.label_seq_id;
  const authSeqId = residues.auth_seq_id;
  for (let i = 0, _i = residues._rowCount; i < _i; i++) {
    const seqId = labelSeqId.value(i) || authSeqId.value(i);
    if (seqId && !map.has(seqId)) {
      map.set(seqId, i);
    }
  }
  return map;
}

export function getResidueLoci(structure: Structure, residueIndex: number): StructureElement.Loci {
  const elements: StructureElement.Loci["elements"][number][] = [];
  for (const unit of structure.units) {
    if (!Unit.isAtomic(unit)) continue;
    const indices: StructureElement.UnitIndex[] = [];
    for (let i = 0, _i = unit.elements.length; i < _i; i++) {
      if (unit.getResidueIndex(i as StructureElement.UnitIndex) === residueIndex) {
        indices.push(i as StructureElement.UnitIndex);
      }
    }
    if (indices.length > 0) {
      elements.push({ unit, indices: OrderedSet.ofSortedArray(indices) });
    }
  }
  return StructureElement.Loci(structure, elements);
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

export type AminoAcidSequence = string & { readonly __brand: unique symbol };

export const isProteinSequence = (sequence: string): sequence is AminoAcidSequence => {
  const validAminoAcids = /^[ACDEFGHIKLMNPQRSTVWYBUXZ]+$/i;
  return validAminoAcids.test(sequence.trim());
};

// A special string type requiring passing the isPDBID type guard
export type PDBID = string & { readonly __brand: unique symbol };

export const isPDBID = (input: string): input is PDBID => {
  const pdbPattern = /^[0-9A-Z]{4}$/i;
  return pdbPattern.test(input.trim());
};

export type PDBChainsData = {
  id: string;
  name: string;
  sequence: AminoAcidSequence;
};

export type ChainSequenceGroup<T extends { id: string; sequence: AminoAcidSequence }> = {
  ids: string[];
  sequence: AminoAcidSequence;
  items: T[];
};

export const groupChainsBySequence = <T extends { id: string; sequence: AminoAcidSequence }>(
  chains: T[]
): Array<ChainSequenceGroup<T>> => {
  const groupsBySequence = new Map<string, ChainSequenceGroup<T>>();
  const orderedGroups: Array<ChainSequenceGroup<T>> = [];

  chains.forEach((chain) => {
    const existing = groupsBySequence.get(chain.sequence);
    if (existing) {
      existing.ids.push(chain.id);
      existing.items.push(chain);
    } else {
      const group = { ids: [chain.id], sequence: chain.sequence, items: [chain] };
      groupsBySequence.set(chain.sequence, group);
      orderedGroups.push(group);
    }
  });

  return orderedGroups;
};

export const formatChainIds = (ids: string[]) => {
  if (ids.length <= 1) return ids[0] ?? "";
  if (ids.length === 2) return `${ids[0]} & ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")} & ${ids[ids.length - 1]}`;
};

interface PolymerEntity {
  entity_poly: {
    pdbx_seq_one_letter_code_can: string;
  };
  polymer_entity_instances: Array<{
    rcsb_id: string;
    rcsb_polymer_entity_instance_container_identifiers: {
      auth_asym_id: string;
    };
  }>;
}

/**
 * Fetches the sequences of a given PDB ID. There may be multiple sequences for proteins with
 * multiple chains.
 */
export const getPDBChainsData = async (pdbId: PDBID): Promise<PDBChainsData[]> => {
  const query = `
    query GetFastaSequence($pdbId: String!) {
      entry(entry_id: $pdbId) {
        polymer_entities {
          entity_poly {
            pdbx_seq_one_letter_code_can
            rcsb_sample_sequence_length
          }
          polymer_entity_instances {
            rcsb_id
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
    const sequence = entity.entity_poly.pdbx_seq_one_letter_code_can as AminoAcidSequence;

    return entity.polymer_entity_instances.map(
      (instance: PolymerEntity["polymer_entity_instances"][0]) => {
        const chainId = instance.rcsb_polymer_entity_instance_container_identifiers.auth_asym_id;
        return {
          id: chainId,
          name: instance.rcsb_id,
          sequence,
        };
      }
    );
  });
};

// A single amino acid chain and its SAE activations. If from the PDB, the id will be
// set to the auth_asym_id, e.g. "A". If from a user-submitted sequence, the id will be
// set to "Unknown". Name is an optional display name only applicable to PDB chains.
export type ChainActivationsData = {
  id: string;
  name?: string;
  sequence: AminoAcidSequence;
  activations: number[];
};

export type ProteinActivationsData = {
  pdbId?: PDBID;
  chains: ChainActivationsData[];
};

export const constructProteinActivationsDataFromPDBID = async (
  pdbId: PDBID,
  feature: number,
  saeName: string
): Promise<ProteinActivationsData> => {
  const seqsData = await getPDBChainsData(pdbId);
  const chains = await Promise.all(
    seqsData.map(async (seqData) => ({
      id: seqData.id,
      name: seqData.name,
      sequence: seqData.sequence,
      activations: await getSAEDimActivations({
        sequence: seqData.sequence,
        dim: feature,
        sae_name: saeName,
      }),
    }))
  );
  return { pdbId, chains };
};

export const constructProteinActivationsDataFromSequence = async (
  sequence: AminoAcidSequence,
  feature: number,
  saeName: string
): Promise<ProteinActivationsData> => {
  const activations = await getSAEDimActivations({
    sequence,
    dim: feature,
    sae_name: saeName,
  });
  return {
    chains: [{ id: "Unknown", sequence, activations }],
  };
};
