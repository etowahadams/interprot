import { AminoAcidSequence, PDBID } from "./utils";
import curatedFeaturesData from "./data/curated-features.json";
import contributorsData from "./data/contributors.json";

export type CuratedFeature = {
  name: string;
  dim: number;
  desc: string;
  contributor?: string;
  group?: string;
};

export type SAEConfig = {
  storagePath: string;
  baseModel: string;
  huggingFaceModelName?: string;
  trainingData: string;
  numHiddenDims: number;
  plmLayer: number;
  searchExamples?: { [key: string]: AminoAcidSequence | PDBID };
  curated?: CuratedFeature[];
  defaultDim: number;
  supportsCustomSequence?: boolean;
};

export const CONTRIBUTORS: Record<string, string> = contributorsData;

export const STORAGE_ROOT_URL =
  "https://raw.githubusercontent.com/liambai/plm-interp-viz-data/refs/heads/main";

export const HUGGINGFACE_REPO_URL = "https://huggingface.co/liambai/InterProt-ESM2-SAEs/blob/main";
export const HUGGINGFACE_DOWNLOAD_URL =
  "https://huggingface.co/liambai/InterProt-ESM2-SAEs/resolve/main";

export const SAE_CONFIGS: Record<string, SAEConfig> = {
  "SAE4096-L24": {
    storagePath: "esm2_plm1280_l24_sae4096_100Kseqs",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    huggingFaceModelName: "esm2_plm1280_l24_sae4096_100k.safetensors",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
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
    curated: curatedFeaturesData["SAE4096-L24"],
    defaultDim: 4000,
    supportsCustomSequence: true,
  },
  "SAE4096-L4": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l4_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l4_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 4,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L4"],
  },
  "SAE4096-L8": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l8_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l8_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 8,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L8"],
  },
  "SAE4096-L12": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l12_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l12_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 12,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L12"],
  },
  "SAE4096-L16": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l16_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l16_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 16,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L16"],
  },
  "SAE4096-L20": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l20_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l20_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 20,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L20"],
  },
  "SAE4096-L28": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l28_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l28_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 28,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L28"],
  },
  "SAE4096-L32": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l32_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l32_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 32,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L32"],
  },
  "SAE4096-L33": {
    storagePath: "4096_layer_sweep/esm2_plm1280_l33_sae4096_k64_auxk640",
    huggingFaceModelName: "esm2_plm1280_l33_sae4096.safetensors",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 4096,
    plmLayer: 33,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE4096-L33"],
  },
  "SAE4096-L24-ab": {
    storagePath: "esm2_plm1280_l24_sae4096_k128_auxk512_antibody_seqs",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[PLAbDab](https://opig.stats.ox.ac.uk/webapps/plabdab/)",
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
    curated: curatedFeaturesData["SAE4096-L24-ab"],
  },
  "SAE8192-L24": {
    storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k16_auxk640",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 8192,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["SAE8192-L24"],
  },
  "ESM-L24": {
    storagePath: "esm2_l24",
    baseModel: "[ESM-2 650M](https://huggingface.co/facebook/esm2_t33_650M_UR50D)",
    trainingData: "[UniRef50](https://www.uniprot.org/help/uniref)",
    numHiddenDims: 1280,
    plmLayer: 24,
    defaultDim: 0,
    supportsCustomSequence: false,
    curated: curatedFeaturesData["ESM-L24"],
  },
  // NOTE(liam): Commenting these out cuz they aren't that interesting, leaving one 8192-dim model for now.
  // "SAE8192-L24-K32": {
  //   storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k32_auxk640",
  //   description: "",
  //   numHiddenDims: 8192,
  //   plmLayer: 24,
  //   defaultDim: 0,
  //   supportsCustomSequence: false,
  //   curated: [],
  // },
  // "SAE8192-L24-K64": {
  //   storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k64_auxk640",
  //   description: "",
  //   numHiddenDims: 8192,
  //   plmLayer: 24,
  //   defaultDim: 0,
  //   supportsCustomSequence: false,
  //   curated: [],
  // },
  // "SAE8192-L24-K128": {
  //   storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k128_auxk640",
  //   description: "",
  //   numHiddenDims: 8192,
  //   plmLayer: 24,
  //   defaultDim: 0,
  //   supportsCustomSequence: false,
  //   curated: [],
  // },
  // "SAE8192-L24-K256": {
  //   storagePath: "k_sweep/esm2_plm1280_l24_sae8192_k256_auxk640",
  //   description: "",
  //   numHiddenDims: 8192,
  //   plmLayer: 24,
  //   defaultDim: 0,
  //   supportsCustomSequence: false,
  //   curated: [],
  // },
};
