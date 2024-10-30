/**
 * Color map from white to red
 */
export function redColorMap(value: number, maxValue: number) {
  // Ensure value is between 0 and maxValue
  value = Math.max(0, Math.min(value, maxValue));

  // Normalize value between 0 and 1
  const normalized = value / maxValue;

  // Interpolate between white (255, 255, 255) and red (255, 0, 0)
  const red = 255;
  const green = Math.round(255 * (1 - normalized));
  const blue = Math.round(255 * (1 - normalized));

  // Return the interpolated color as a hex string
  return `rgb(${red}, ${green}, ${blue})`;
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

  // Return the interpolated color as a hex string
  return [red, green, blue];
}

// PDBeMolstarPlugin doesn't allow color in rgb format
export function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return `#${hex}`;
}

// Generates the "color" data given the activation list
export function residueColor(activation_list: Array<number>) {
  const max_activation = Math.max(...activation_list);
  return activation_list.map((activation, i) => ({
    struct_asym_id: "A",
    residue_number: i + 1,
    color: rgbToHex(redColorMap(activation, max_activation)),
  }));
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
