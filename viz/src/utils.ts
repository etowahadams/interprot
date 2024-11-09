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

export const isProteinSequence = (sequence: string): boolean => {
  const validAminoAcids = /^[ACDEFGHIKLMNPQRSTVWYBUXZ]+$/i;
  return validAminoAcids.test(sequence.trim());
};

export const isPDBID = (input: string): boolean => {
  const pdbPattern = /^[0-9A-Z]{4}$/i;
  return pdbPattern.test(input.trim());
};

export const getPDBSequence = async (pdbId: string): Promise<string> => {
  const pdbResponse = await fetch(`https://www.rcsb.org/fasta/entry/${pdbId}/display`);
  const fastaText = await pdbResponse.text();
  const sequences = fastaText.split(">").filter(Boolean);
  if (sequences.length === 0) return "";
  const sequenceLines = sequences[0].split("\n");
  return sequenceLines.slice(1).join("").trim();
};
