import { AminoAcidSequence, PDBID } from "./utils";

export type CuratedFeature = {
  name: string;
  dim: number;
  desc: string;
  contributor?: string;
  group?: string;
};

export type SAEConfig = {
  storagePath: string;
  description: string;
  numHiddenDims: number;
  plmLayer: number;
  searchExamples?: { [key: string]: AminoAcidSequence | PDBID };
  curated?: CuratedFeature[];
  defaultDim: number;
  supportsCustomSequence?: boolean;
};

export const CONTRIBUTORS: Record<string, string> = {
  "Diego del Alamo": "https://x.com/ddelalamo",
  "Daniel Saltzberg": "https://x.com/dargason",
  "James Michael Krieger": "http://github.com/jamesmkrieger",
};

export const STORAGE_ROOT_URL =
  "https://raw.githubusercontent.com/liambai/plm-interp-viz-data/refs/heads/main";

export const SAE_CONFIGS: Record<string, SAEConfig> = {
  "SAE4096-L24": {
    storagePath: "esm2_plm1280_l24_sae4096_100Kseqs",
    description:
      "This SAE was trained on layer 24 of [ESM2-650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D) using sequences from [UniRef50](https://www.uniprot.org/help/uniref) and has 4096 hidden dimensions. Click on a feature below to visualize its activation pattern.",
    numHiddenDims: 4096,
    plmLayer: 24,
    searchExamples: {
      // @ts-expect-error I know this is a protein sequence
      "WD40 domain sequence":
        "MADTSDLTNYVLPASPNWYCSTGTDFSITGLYGFAAKKCVYLLDVNGPVPAFRGQFTEHTDRVSSVRFCPHALHPGLCASGADDKTVRLWDVETKGVLANHTTHTAKVTSISWSPQVKDLILSADEKGTVIAWYYNKNTVHSTCPIQEYIFCVESSSVSSQQAAVGGELLLWDLSTPSPKDKVHVFGSGHSRIVFNVSCTPCGTKLMTTSMDRQVILWDVARCQQICTIATLGGYVYAMAISPLDPGTLALGVGDNMIRVWHTTSESAPYDAISLWQGIKSKVMMLAGVADKVKFGFLDATFRHDRHLCPGEMAGHMRYHPTREIDLS",
      // @ts-expect-error I know this is a PDB ID
      "PDB 5C03 (Kinase)": "5C03",
      // @ts-expect-error I know this is a protein sequence
      "SH3 domain sequence": "TAGKIFRAMYDYMAADADEVSFKDGDAIINVQAIDEGWMYGTVQRTGRTGMLPANYVEAI",
    },
    curated: [
      {
        name: "beta barrel",
        dim: 4000,
        desc: "This feature activates on transmembrane beta barrels. It highlights every other residue along each beta strand, weaving a criss-cross pattern. It activates on de novo designed proteins (PDB 6X1K, 6X9Z), and natural proteins (PDB 2MLH).",
        contributor: "Diego del Alamo",
        group: "structural",
      },
      {
        name: "WD40 middle loop",
        dim: 4047,
        desc: "This feature activates on the middle loop of [WD40 repeat](https://en.wikipedia.org/wiki/WD40_repeat) domains. It highlights every other disordered region at the tip of the propeller.",
        group: "structural",
        contributor: "Daniel Saltzberg",
      },
      {
        name: "antibody disulfide bridge",
        dim: 1056,
        desc: "Activates on a disulfide bridge in the antigen-binding domain of antibodies. Highlighted in PDB 3HFM, an antibody-antigen complex.",
        group: "structural",
      },
      {
        name: "antibody disordered",
        dim: 2957,
        desc: "Activates disordered regions in antigen-binding domains of antibodies. For example in PDB 8ULH, it activates on 2 loops in both the light and heavy chains.",
        group: "structural",
      },
      {
        name: "membrane exposed helices",
        dim: 3732,
        desc: "This feature activates on membrane-exposed helices, as well as on transmembrane beta barrels like those recognized by feature 4000.",
        contributor: "Diego del Alamo",
        group: "structural",
      },
      {
        name: "signal peptide cleavage site",
        dim: 1737,
        desc: "Activates on signal peptide cleavage sites",
        group: "structural",
        contributor: "James Michael Krieger",
      },
      {
        name: "beta strand channel",
        dim: 3883,
        desc: "This feature activates on channel-like structures consisting of beta strands. It fires on a specific beta strand within the channel.",
        group: "structural",
      },
      {
        name: "hugging helices",
        dim: 3348,
        desc: "This feature activates on the interfacing residues of bunched-together alpha helices. It seems to understand the orientation of the helices as well as the surface exposed to the opposing helices, firing on either a single amino acid or 2 adjacent ones depending on the surface.",
        group: "structural",
      },
      {
        name: "kinase helix",
        dim: 594,
        desc: "This feature activates strongly on a specific helix in kinase domains and weakly on surrounding beta strands. The highlighted helix is always the one opposed to the beta sheet.",
        group: "structural",
      },
      {
        name: "kinase beta mids",
        dim: 294,
        desc: "Activates on the middle residues in the beta sheet in kinase domains. It fires most strongly on the second outer beta strand and doesn't fire on the outermost beta strand at all.",
        group: "structural",
      },
      {
        name: "beta strand motif",
        dim: 88,
        desc: "This feature activates on a specific beta strand motif in ABC transporters. The highlighted beta strand is always the one that opposes an alpha helix.",
        group: "structural",
      },
      {
        name: "perpendicular helix",
        dim: 2320,
        desc: "This feature activates on parts of alpha helices. The highlighted parts tend to be perpendicular to a nearby helix.",
        group: "structural",
      },
      {
        name: "single beta strand",
        dim: 1299,
        desc: "Activates on a single beta strand",
        group: "structural",
      },
      {
        name: "beta strand: first aa",
        dim: 782,
        desc: "Activates on the first amino acid in a specific beta strand",
        group: "structural",
      },
      {
        name: "beta helix",
        dim: 250,
        desc: "Activates on short beta strands in beta helices",
        group: "structural",
      },
      {
        name: "alpha helix turn",
        dim: 56,
        desc: "Activates on the turn between two alpha helices in ABC transporter proteins",
        group: "structural",
      },
      {
        name: "alpha helices in TFs",
        dim: 798,
        desc: "Activates on alpha helices on transcription factors-like proteins",
        group: "structural",
      },
      {
        name: "long alpha helices",
        dim: 1008,
        desc: "Activates on most amino acids in long alpha helices",
        group: "structural",
      },
      {
        name: "leucine rich repeats",
        dim: 3425,
        desc: "Activates on the amino acid before the start of a beta strand in a leucine rich repeat",
        group: "structural",
      },
      {
        name: "helix bunch",
        dim: 3055,
        desc: "Activates on a bunch of alpha helices",
        group: "structural",
      },
      {
        name: "first residue",
        dim: 600,
        desc: "Activates on the first amino acid at the start of a sequence",
        group: "amino acid position",
      },
      {
        name: "second residue",
        dim: 3728,
        desc: "Mostly activates on the second amino acid in a sequence",
        group: "amino acid position",
      },
      {
        name: "last residue",
        dim: 799,
        desc: "Activates on the last amino acid in a sequence",
        group: "amino acid position",
      },
      {
        name: "end",
        dim: 1058,
        desc: "Activates on the last few amino acids in a sequence, with increasing intensity as we get closer to the end",
        group: "amino acid position",
      },
      {
        name: "alanine",
        dim: 3267,
        desc: "Activates on alanine residues",
        group: "amino acid identity",
      },
      {
        name: "cysteine (some)",
        dim: 3812,
        desc: "Activates on some cysteine residues. Typically does not activate on disulfide bridges. Compare with feature 2232 which activates on disulfide bridges.",
        group: "amino acid identity",
      },
      {
        name: "cysteine (disulfide bridge)",
        dim: 2232,
        desc: "Activates on cysteine residues that are part of disulfide bridges. This is clearly demonstrated in PDB 1DSB. PDB 1RQ1 contains lots of cysteine bridges: this feature seems to pick up on the short range ones but not the long range one across residues 52 - 311. Compare with feature 3812 which seems to activate primarily on cysteines that are not part of disulfide bridges.",
        group: "amino acid identity",
        contributor: "James Michael Krieger",
      },
      {
        name: "aspartic acid",
        dim: 2830,
        desc: "Activates on aspartic acid residues",
        group: "amino acid identity",
      },
      {
        name: "glutamic acid",
        dim: 2152,
        desc: "Activates on glutamic acid residues",
        group: "amino acid identity",
      },
      {
        name: "phenylalanine",
        dim: 252,
        desc: "Activates on phenylalanine residues",
        group: "amino acid identity",
      },
      {
        name: "glycine",
        dim: 3830,
        desc: "Activates on glycine residues",
        group: "amino acid identity",
      },
      {
        name: "histidine",
        dim: 743,
        desc: "Activates on histidine residues",
        group: "amino acid identity",
      },
      {
        name: "threonine",
        dim: 220,
        desc: "Activates on threonine residues",
        group: "amino acid identity",
      },
      {
        name: "isoleucine",
        dim: 3978,
        desc: "Activates on isoleucine residues",
        group: "amino acid identity",
      },
      {
        name: "lysine",
        dim: 3073,
        desc: "Activates on lysine residues",
        group: "amino acid identity",
      },
      {
        name: "leucine",
        dim: 1497,
        desc: "Activates on leucine residues",
        group: "amino acid identity",
      },
      {
        name: "valine",
        dim: 3383,
        desc: "Activates on valine residues",
        group: "amino acid identity",
      },
      {
        name: "methionine",
        dim: 444,
        desc: "Activates on methionine residues",
        group: "amino acid identity",
      },
      {
        name: "asparagine",
        dim: 21,
        desc: "Activates on asparagine residues",
        group: "amino acid identity",
      },
      {
        name: "proline",
        dim: 1386,
        desc: "Activates on proline residues",
        group: "amino acid identity",
      },
      {
        name: "glutamine",
        dim: 1266,
        desc: "Activates on glutamine residues",
        group: "amino acid identity",
      },
      {
        name: "serine",
        dim: 1473,
        desc: "Activates on serine residues",
        group: "amino acid identity",
      },
      {
        name: "tryptophan",
        dim: 2685,
        desc: "Activates on tryptophan residues",
        group: "amino acid identity",
      },
      {
        name: "tyrosine",
        dim: 3481,
        desc: "Activates on tyrosine residues",
        group: "amino acid identity",
      },
      {
        name: "arginine",
        dim: 3569,
        desc: "Activates on arginine residues",
        group: "amino acid identity",
      },
      {
        name: "kinase beta strands",
        dim: 3642,
        desc: "Activates on some beta strands in kinase domains and weakly on the C-helix",
        group: "structural",
      },
      {
        name: "kinase beta strand",
        dim: 3260,
        desc: "Activates on a beta strand in kinase domains",
        group: "structural",
      },
      {
        name: "kinase beta strand",
        dim: 16,
        desc: "Activates on a beta strand in kinase domains",
        group: "structural",
      },
      {
        name: "beta strand hammock",
        dim: 179,
        desc: "Activates on a beta strand and the disordered regions at each end",
        group: "structural",
      },
      {
        name: "i+7 #1",
        dim: 2293,
        desc: "This feature activates strongly on every 7th amino acid (approximately two full turns) in alpha helices.",
        group: "alpha helix",
      },
      {
        name: "i+7 #2",
        dim: 3677,
        desc: "This feature activates strongly on every 7th amino acid (approximately two full turns) in alpha helices.",
        group: "alpha helix",
      },
      {
        name: "i+7 #3",
        dim: 274,
        desc: "This feature activates strongly on every 7th amino acid (approximately two full turns) in alpha helices.",
        group: "alpha helix",
      },
      {
        name: "i+7 #4",
        dim: 3791,
        desc: "This feature activates strongly on every 7th amino acid (approximately two full turns) in alpha helices.",
        group: "alpha helix",
      },
      {
        name: "2 sets of i+7",
        dim: 3430,
        desc: "This feature actives on repeating patterns every 7th amino acid in alpha helices.",
        group: "alpha helix",
      },
      {
        name: "2 sets of i+7",
        dim: 2364,
        desc: "This feature actives on repeating patterns every 7th amino acid in alpha helices.",
        group: "alpha helix",
      },
      {
        name: "3 sets of i+7, one side",
        dim: 303,
        desc: "Activates on one side of the alpha helix, with a repeating pattern every 7th amino acid.",
        group: "alpha helix",
      },
      {
        name: "first aa",
        dim: 3451,
        desc: "Activates on the first amino acid in short buried alpha helices",
        group: "alpha helix",
      },
      {
        name: "disordered #1",
        dim: 505,
        desc: "Activates on disordered regions",
        group: "disordered",
      },
      {
        name: "disordered #2",
        dim: 2852,
        desc: "Activates on disordered regions",
        group: "disordered",
      },
      {
        name: "disordered #3",
        dim: 2763,
        desc: "Activates on disordered regions",
        group: "disordered",
      },
    ],
    defaultDim: 4000,
    supportsCustomSequence: true,
  },
  "SAE4096-L4": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l4_sae4096_k64_auxk640",
    description:
      "This SAE was trained on layer 4 of [ESM2-650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D) using sequences from [UniRef50](https://www.uniprot.org/help/uniref) and has 4096 hidden dimensions. Click on a feature below to visualize its activation pattern.",
    numHiddenDims: 4096,
    plmLayer: 4,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L8": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l8_sae4096_k64_auxk640",
    description:
      "This SAE was trained on layer 8 of [ESM2-650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D) using sequences from [UniRef50](https://www.uniprot.org/help/uniref) and has 4096 hidden dimensions. Click on a feature below to visualize its activation pattern.",
    numHiddenDims: 4096,
    plmLayer: 8,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L12": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l12_sae4096_k64_auxk640",
    description:
      "This SAE was trained on layer 12 of [ESM2-650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D) using sequences from [UniRef50](https://www.uniprot.org/help/uniref) and has 4096 hidden dimensions. Click on a feature below to visualize its activation pattern.",
    numHiddenDims: 4096,
    plmLayer: 12,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L16": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l16_sae4096_k64_auxk640",
    description: "",
    numHiddenDims: 4096,
    plmLayer: 16,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L20": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l20_sae4096_k64_auxk640",
    description: "",
    numHiddenDims: 4096,
    plmLayer: 20,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L28": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l28_sae4096_k64_auxk640",
    description: "",
    numHiddenDims: 4096,
    plmLayer: 28,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L32": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l32_sae4096_k64_auxk640",
    description: "",
    numHiddenDims: 4096,
    plmLayer: 32,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L33": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l33_sae4096_k64_auxk640",
    description: "",
    numHiddenDims: 4096,
    plmLayer: 33,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE4096-L24-ab": {
    storagePath: "esm2_plm1280_l24_sae4096_k128_auxk512_antibody_seqs",
    description:
      "This SAE was trained on layer 24 of [ESM2-650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D) using antibody sequences from [PLAbDab](https://opig.stats.ox.ac.uk/webapps/plabdab/) and has 4096 hidden dimensions. Click on a feature below to visualize its activation pattern.",
    numHiddenDims: 4096,
    plmLayer: 24,
    searchExamples: {
      // @ts-expect-error I know this is a PDB ID
      "PDB 5JW5 (MEDI8852, binds influenza A hemagglutinin)": "5JW5",
      // @ts-expect-error I know this is a PDB ID
      "PDB 5FHA (mAb114, binds ebolavirus glycoprotein)": "5FHA",
      // @ts-expect-error I know this is a protein sequence
      "REGN10987 (binds SARS-CoV-2 spike protein) light chain sequence":
        "QSALTQPASVSGSPGQSITISCTGTSSDVGGYNYVSWYQQHPGKAPKLMIYDVSKRPSGVSNRFSGSKSGNTASLTISGLQSEDEADYYCNSLTSISTWVFGGGTKLTVLGQPKAAPSVTLFPPSSEELQANKATLVCLISDFYPGAVTVAWKADSSPVKAGVETTTPSKQSNNKYAASSYLSLTPEQWKSHRSYSCQVTHEGSTVEKTVAPTECS",
    },
    defaultDim: 2699,
    supportsCustomSequence: false,
    curated: [
      {
        name: "CDR2",
        dim: 2699,
        desc: "Activates around the CDR2 (2nd [Complementarity Determining Region](https://en.wikipedia.org/wiki/Complementarity-determining_region)) loop for both the heavy and light chains. For example, PDB [8YWP](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab/structureviewer/?pdb=8ywp) has YASNRYT as the light chain CDR2 sequence and WWDDD as the heavy chain CDR2 sequence.",
        group: "CDR",
      },
      {
        name: "CDR3",
        dim: 195,
        desc: "Activates around the CDR3 (3rd CDR) loop for both the heavy and light chains. For example, PDB [8ULH](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab/structureviewer/?pdb=8ulh) has MQATHWPGT as the light chain CDR3 sequence and DVPVVAAVLRDY as the heavy chain CDR3 sequence.",
        group: "CDR",
      },
      {
        name: "h2",
        dim: 2817,
        desc: "Activates on the H2 CDR loop. For example, PDB [9DF0](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab/structureviewer/?pdb=9df0) has YYSGN as the H2 CDR sequence.",
        group: "CDR",
      },
      {
        name: "h1 start",
        dim: 3369,
        desc: "Activates on the first amino acid in the H1 CDR loop",
        group: "CDR",
      },
      {
        name: "h1 end",
        dim: 2295,
        desc: "Activates on the last amino acid in the H1 CDR loop",
        group: "CDR",
      },
      {
        name: "h3 start",
        dim: 923,
        desc: "Activates on the first amino acid in the H3 CDR loop",
        group: "CDR",
      },
      {
        name: "beta sheet alternating",
        dim: 305,
        desc: "Activates on beta sheets in a weaving pattern. While it activates most strongly on cadherins, it also activates on beta barrels (e.g. PDB 2MLH).",
        group: "structural",
      },
      {
        name: "beta strand middle residue",
        dim: 2832,
        desc: "Activates on the middle residue of a beta strand in antibody domains",
        group: "structural",
      },
      {
        name: "pumilio domain interior",
        dim: 3729,
        desc: "Activates on the interior of the Pumilio RNA-binding domains",
        group: "structural",
      },
      {
        name: "one apart",
        dim: 1124,
        desc: "Activates on two residues that are one apart. For the top activating sequences, the activation tends to be in disordered regions of antibodies.",
        group: "amino acid position",
      },
      {
        name: "alanine",
        dim: 155,
        desc: "Activates on alanine residues",
        group: "amino acid identity",
      },
      {
        name: "glycine",
        dim: 2872,
        desc: "Activates on glycine residues",
        group: "amino acid identity",
      },
      {
        name: "leucine",
        dim: 223,
        desc: "Activates on leucine residues",
        group: "amino acid identity",
      },
      {
        name: "aspartic acid",
        dim: 2908,
        desc: "Activates on aspartic acid residues",
        group: "amino acid identity",
      },
      {
        name: "tyrosine",
        dim: 65,
        desc: "Activates on tyrosine residues",
        group: "amino acid identity",
      },
      {
        name: "isoleucine",
        dim: 2190,
        desc: "Activates on isoleucine residues",
        group: "amino acid identity",
      },
      {
        name: "valine",
        dim: 445,
        desc: "Activates on valine residues",
        group: "amino acid identity",
      },
      {
        name: "serine",
        dim: 2469,
        desc: "Activates on serine residues",
        group: "amino acid identity",
      },
      {
        name: "methionine",
        dim: 1087,
        desc: "Activates on methionine residues",
        group: "amino acid identity",
      },
      {
        name: "threonine",
        dim: 3234,
        desc: "Activates on threonine residues",
        group: "amino acid identity",
      },
      {
        name: "histidine",
        dim: 767,
        desc: "Activates on histidine residues",
        group: "amino acid identity",
      },
      {
        name: "first residue",
        dim: 3558,
        desc: "Activates on the first amino acid at the start of a sequence",
        group: "amino acid position",
      },
      {
        name: "lysine",
        dim: 335,
        desc: "Activates on lysine residues",
        group: "amino acid identity",
      },
      {
        name: "end",
        dim: 2599,
        desc: "Activates on the last few amino acids in a sequence, with increasing intensity as we get closer to the end",
        group: "amino acid position",
      },
    ],
  },
  "SAE8192-L24-K16": {
    storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k16_auxk640",
    description: "",
    numHiddenDims: 8192,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE8192-L24-K32": {
    storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k32_auxk640",
    description: "",
    numHiddenDims: 8192,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE8192-L24-K64": {
    storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k64_auxk640",
    description: "",
    numHiddenDims: 8192,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE8192-L24-K128": {
    storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k128_auxk640",
    description: "",
    numHiddenDims: 8192,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
  "SAE8192-L24-K256": {
    storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k256_auxk640",
    description: "",
    numHiddenDims: 8192,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: [],
  },
};
