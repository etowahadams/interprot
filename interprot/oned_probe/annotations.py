from dataclasses import dataclass


@dataclass
class ResidueAnnotation:
    name: str
    swissprot_header: str
    class_names: list[str]

    # Class name used to indicate that we don't care about the annotation class,
    # as long as the annotation exists. E.g. signal peptides annotations look like
    # `{'start': 1, 'end': 24, 'evidence': 'ECO:0000255'}`, so we just classify
    # whether the residue is part of a signal peptide or not.
    ALL_CLASSES = "all"


RESIDUE_ANNOTATIONS = [
    ResidueAnnotation(
        name="DNA binding",
        swissprot_header="DNA_BIND",
        class_names=["H-T-H motif", "Homeobox", "Nuclear receptor", "HMG box"],
    ),
    ResidueAnnotation(
        name="Motif",
        swissprot_header="MOTIF",
        class_names=[
            "Nuclear localization signal",
            "Nuclear export signal",
            "DEAD box",
            "Cell attachment site",
            "JAMM motif",
            "SH3-binding",
            "Cysteine switch",
        ],
    ),
    ResidueAnnotation(
        name="Topological domain",
        swissprot_header="TOPO_DOM",
        class_names=[
            "Cytoplasmic",
            "Extracellular",
            "Lumenal",
            "Periplasmic",
            "Mitochondrial intermembrane",
            "Mitochondrial matrix",
            "Virion surface",
            "Intravirion",
        ],
    ),
    ResidueAnnotation(
        name="Domain [FT]",
        swissprot_header="DOMAIN",
        class_names=[
            "Protein kinase",
            "tr-type G",
            "Radical SAM core",
            "ABC transporter",
            "Helicase ATP-binding",
            "Glutamine amidotransferase type-1",
            "ATP-grasp",
            "S4 RNA-binding",
        ],
    ),
    ResidueAnnotation(
        name="Active site",
        swissprot_header="ACT_SITE",
        class_names=[
            "Proton acceptor",
            "Proton donor",
            "Nucleophile",
            "Charge relay system",
        ],
    ),
    ResidueAnnotation(
        name="Signal peptide",
        swissprot_header="SIGNAL",
        class_names=[ResidueAnnotation.ALL_CLASSES],
    ),
    ResidueAnnotation(
        name="Transit peptide",
        swissprot_header="TRANSIT",
        class_names=[ResidueAnnotation.ALL_CLASSES, "Mitochondrion", "Chloroplast"],
    ),
    ResidueAnnotation(
        name="Helix",
        swissprot_header="HELIX",
        class_names=[ResidueAnnotation.ALL_CLASSES],
    ),
    ResidueAnnotation(
        name="Beta strand",
        swissprot_header="STRAND",
        class_names=[ResidueAnnotation.ALL_CLASSES],
    ),
    ResidueAnnotation(
        name="Turn",
        swissprot_header="TURN",
        class_names=[ResidueAnnotation.ALL_CLASSES],
    ),
    ResidueAnnotation(
        name="Coiled coil",
        swissprot_header="COILED",
        class_names=[ResidueAnnotation.ALL_CLASSES],
    ),
    ResidueAnnotation(
        name="Region",
        swissprot_header="REGION",
        class_names=["Disordered", "Interaction with tRNA"],  # TODO: Add more
    ),
    ResidueAnnotation(
        name="Amino acid identity",
        swissprot_header="AA_IDENTITY",
        class_names=[
            "A",
            "R",
            "N",
            "D",
            "C",
            "Q",
            "E",
            "G",
            "H",
            "I",
            "L",
            "K",
            "M",
            "F",
            "P",
            "S",
            "T",
            "W",
            "Y",
            "V",
        ],
    ),
]
RESIDUE_ANNOTATION_NAMES = {a.name for a in RESIDUE_ANNOTATIONS}
