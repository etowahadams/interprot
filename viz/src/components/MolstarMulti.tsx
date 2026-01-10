import React, { useEffect, useRef, useState, memo } from "react";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import {
  Model,
  ElementIndex,
  Structure,
  StructureElement,
  Unit,
} from "molstar/lib/mol-model/structure";
import { OrderedSet } from "molstar/lib/mol-data/int";
import { Color } from "molstar/lib/mol-util/color";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import proteinEmoji from "../protein.png";
import { redColorMapRGB, redColorMapHex, createMolstarSpec, parseMolstarLabel } from "@/utils.ts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SeqWithSAEActs } from "./SeqsViewer";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface MolstarViewerProps {
  proteins: SeqWithSAEActs[];
  hoveredProteinId?: string | null;
  onProteinHover?: (alphafoldId: string | null) => void;
}

const PROTEIN_CANVAS_SIZE = 400;

const MolstarMulti: React.FC<MolstarViewerProps> = memo(function MolstarMulti({
  proteins,
  hoveredProteinId,
  onProteinHover,
}) {
  const [proteinImages, setProteinImages] = useState<(string | null)[]>(
    Array(proteins.length).fill(null)
  );
  const [activeViewerIndices, setActiveViewerIndices] = useState<Set<number>>(new Set());
  const [hoverLabels, setHoverLabels] = useState<Map<number, string | null>>(new Map());
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [zoomHoverLabel, setZoomHoverLabel] = useState<string | null>(null);
  const [structureHoverIndex, setStructureHoverIndex] = useState<number | null>(null);
  const [sequenceHoverIndex, setSequenceHoverIndex] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [blocksPerRow, setBlocksPerRow] = useState(4);
  const pluginRef = useRef<PluginContext | null>(null);
  const activePluginsRef = useRef<Map<number, PluginContext>>(new Map());
  const zoomPluginRef = useRef<PluginContext | null>(null);
  const zoomViewerContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomStructureRef = useRef<Structure | null>(null);
  const residueIndexBySeqIdRef = useRef<Map<number, number>>(new Map());
  const residueLociCacheRef = useRef<Map<number, StructureElement.Loci>>(new Map());
  const sequenceContainerRef = useRef<HTMLDivElement | null>(null);
  const offscreenContainerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const createResidueColorTheme = (activationList: number[], name = "residue-colors") => {
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
          const color =
            maxValue > 0 ? redColorMapRGB(activationList[e], maxValue) : [255, 255, 255];
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
  };

  const parseResidueIndexFromLabel = (label: string | null) => {
    if (!label) return null;
    const match = label.match(/(\d+)/);
    if (!match) return null;
    const residueNumber = Number(match[1]);
    return Number.isNaN(residueNumber) ? null : residueNumber - 1;
  };

  const buildResidueIndexMap = (structure: Structure) => {
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
  };

  const getResidueLoci = (structure: Structure, residueIndex: number) => {
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
  };

  const initViewer = async (
    element: HTMLDivElement,
    interactiveIndex?: number,
    onHoverLabel?: (label: string | null) => void,
    canvasSize?: { width: number; height: number }
  ) => {
    const canvas = document.createElement("canvas");
    const size = canvasSize ?? { width: PROTEIN_CANVAS_SIZE, height: PROTEIN_CANVAS_SIZE };
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    element.appendChild(canvas);

    const spec = createMolstarSpec();
    const plugin = new PluginContext(spec);
    await plugin.init();
    plugin.initViewer(canvas, element);

    // Only set up hover labels for interactive viewers
    if (interactiveIndex !== undefined || onHoverLabel) {
      plugin.managers.interactivity.setProps({ granularity: "residue" });
      plugin.behaviors.labels.highlight.subscribe(({ labels }) => {
        const label = labels.length > 0 ? parseMolstarLabel(String(labels[0])) : null;
        if (interactiveIndex !== undefined) {
          setHoverLabels((prev) => {
            const newMap = new Map(prev);
            newMap.set(interactiveIndex, label);
            return newMap;
          });
        }
        onHoverLabel?.(label);
      });
    }

    return plugin;
  };

  const loadStructure = async (
    plugin: PluginContext,
    protein: SeqWithSAEActs,
    index: number,
    isInteractive: boolean = false
  ) => {
    try {
      const fileName = `https://alphafold.ebi.ac.uk/files/AF-${protein.alphafold_id}-F1-model_v6.cif`;

      const themeName = Math.random().toString(36).substring(7);
      const ResidueColorTheme = createResidueColorTheme(protein.sae_acts, themeName);
      plugin.representation.structure.themes.colorThemeRegistry.add(
        ResidueColorTheme.colorThemeProvider!
      );

      const structureData = await plugin.builders.data.download({
        url: fileName,
        isBinary: fileName.endsWith(".bcif"),
      });

      const trajectory = await plugin.builders.structure.parseTrajectory(structureData, "mmcif");
      await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");

      plugin.dataTransaction(async () => {
        for (const s of plugin.managers.structure.hierarchy.current.structures) {
          await plugin.managers.structure.component.updateRepresentationsTheme(s.components, {
            color: ResidueColorTheme.propertyProvider.descriptor.name as any,
          });
        }
      });

      if (!isInteractive) {
        // Wait a bit for the structure to render
        await new Promise((resolve) => setTimeout(resolve, 100));
        const nextFrame = () =>
          new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        // Firefox needs this or else there will be a lot of blank images
        try {
          (plugin.canvas3d as any)?.webgl?.gl?.flush?.();
        } catch {}
        // Wait for a couple of RAFs to let WebGL settle
        await nextFrame();
        await nextFrame();
        const canvas = offscreenContainerRef.current?.querySelector("canvas");
        if (!canvas) throw new Error("Canvas not found");
        const imageUrl = canvas.toDataURL("image/png");

        setProteinImages((prev) => {
          const newImages = [...prev];
          newImages[index] = imageUrl;
          return newImages;
        });
      }
    } catch (error) {
      console.error("Error loading structure:", error);
      throw error;
    }
  };

  const renderProteins = async () => {
    if (!offscreenContainerRef.current) return;

    if (!pluginRef.current) {
      pluginRef.current = await initViewer(offscreenContainerRef.current);
    }

    try {
      for (let i = 0; i < proteins.length; i++) {
        await loadStructure(pluginRef.current, proteins[i], i);
        await pluginRef.current.clear();
      }
    } catch (error) {
      console.error("Error rendering proteins:", error);
    }
  };

  const handleProteinClick = async (index: number) => {
    if (activeViewerIndices.has(index)) {
      return;
    }

    const viewerContainer = viewerContainerRefs.current[index];
    if (!viewerContainer) return;

    try {
      const plugin = await initViewer(viewerContainer, index);
      activePluginsRef.current.set(index, plugin);
      await loadStructure(plugin, proteins[index], index, true);
      setActiveViewerIndices((prev) => {
        const newSet = new Set(prev);
        newSet.add(index);
        return newSet;
      });
    } catch (error) {
      console.error("Error initializing interactive viewer:", error);
    }
  };

  useEffect(() => {
    setProteinImages(Array(proteins.length).fill(null));
    activeViewerIndices.clear();
    activePluginsRef.current.forEach((plugin) => plugin.dispose());
    setZoomedIndex(null);
    renderProteins();
  }, [proteins]);

  useEffect(() => {
    const legacyUniprot = searchParams.get("zoomUniprot");
    const urlUniprot = searchParams.get("uniprot") ?? legacyUniprot;
    if (!urlUniprot || isMobile) {
      if (zoomedIndex !== null) {
        setZoomedIndex(null);
      }
      if (isMobile && (searchParams.get("uniprot") || legacyUniprot)) {
        const next = new URLSearchParams(searchParams);
        next.delete("uniprot");
        next.delete("zoomUniprot");
        setSearchParams(next);
      }
      return;
    }
    if (legacyUniprot && !searchParams.get("uniprot")) {
      const next = new URLSearchParams(searchParams);
      next.set("uniprot", legacyUniprot);
      next.delete("zoomUniprot");
      setSearchParams(next);
      return;
    }
    const nextIndex = proteins.findIndex((protein) => protein.uniprot_id === urlUniprot);
    if (nextIndex === -1) return;
    if (zoomedIndex !== nextIndex) {
      setZoomedIndex(nextIndex);
    }
  }, [proteins, searchParams, setSearchParams, zoomedIndex, isMobile]);

  useEffect(() => {
    if (zoomedIndex === null) {
      if (zoomPluginRef.current) {
        zoomPluginRef.current.dispose();
        zoomPluginRef.current = null;
      }
      zoomStructureRef.current = null;
      residueIndexBySeqIdRef.current = new Map();
      residueLociCacheRef.current = new Map();
      setZoomHoverLabel(null);
      setStructureHoverIndex(null);
      setSequenceHoverIndex(null);
      return;
    }

    let cancelled = false;
    const setupZoomViewer = async () => {
      try {
        let attempts = 0;
        while (!cancelled && !zoomViewerContainerRef.current && attempts < 60) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          attempts++;
        }
        const viewerContainer = zoomViewerContainerRef.current;
        if (!viewerContainer || cancelled) return;

        setZoomHoverLabel(null);
        setStructureHoverIndex(null);
        setSequenceHoverIndex(null);
        if (zoomPluginRef.current) {
          zoomPluginRef.current.dispose();
        }
        zoomStructureRef.current = null;
        residueIndexBySeqIdRef.current = new Map();
        residueLociCacheRef.current = new Map();

        viewerContainer.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
        const rect = viewerContainer.getBoundingClientRect();
        const width = Math.max(PROTEIN_CANVAS_SIZE, Math.floor(rect.width) || PROTEIN_CANVAS_SIZE);
        const height = Math.max(
          PROTEIN_CANVAS_SIZE,
          Math.floor(rect.height) || PROTEIN_CANVAS_SIZE
        );
        const plugin = await initViewer(
          viewerContainer,
          undefined,
          (label) => {
            setZoomHoverLabel(label);
            setStructureHoverIndex(parseResidueIndexFromLabel(label));
          },
          { width, height }
        );
        if (cancelled) {
          plugin.dispose();
          return;
        }
        zoomPluginRef.current = plugin;
        await loadStructure(plugin, proteins[zoomedIndex], zoomedIndex, true);

        if (cancelled) return;
        const structure = plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
        if (structure) {
          zoomStructureRef.current = structure;
          residueIndexBySeqIdRef.current = buildResidueIndexMap(structure);
          residueLociCacheRef.current = new Map();
        }
      } catch (error) {
        console.error("Error initializing zoom viewer:", error);
      }
    };

    setupZoomViewer();

    return () => {
      cancelled = true;
      if (zoomPluginRef.current) {
        zoomPluginRef.current.dispose();
        zoomPluginRef.current = null;
      }
    };
  }, [zoomedIndex, proteins]);

  useEffect(() => {
    const plugin = zoomPluginRef.current;
    const structure = zoomStructureRef.current;
    if (!plugin || !structure) return;

    if (sequenceHoverIndex === null) {
      plugin.managers.interactivity.lociHighlights.clearHighlights();
      return;
    }

    const seqId = sequenceHoverIndex + 1;
    let loci = residueLociCacheRef.current.get(seqId);
    if (!loci) {
      const residueIndex = residueIndexBySeqIdRef.current.get(seqId);
      if (residueIndex === undefined) return;
      loci = getResidueLoci(structure, residueIndex);
      residueLociCacheRef.current.set(seqId, loci);
    }
    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci });
  }, [sequenceHoverIndex]);

  const zoomedProtein = zoomedIndex !== null ? proteins[zoomedIndex] : null;
  const activeResidueIndex = sequenceHoverIndex ?? structureHoverIndex;
  const zoomMaxActivation =
    zoomedProtein && zoomedProtein.sae_acts.length > 0 ? Math.max(...zoomedProtein.sae_acts) : 0;
  const residuesPerBlock = 10;
  const blockWidthPx = 176;
  const blockGapPx = 24;
  const sequenceBlocks = zoomedProtein
    ? Array.from({
        length: Math.ceil(zoomedProtein.sequence.length / residuesPerBlock),
      }).map((_, blockIndex) => ({
        start: blockIndex * residuesPerBlock,
        end: Math.min(
          zoomedProtein.sequence.length,
          blockIndex * residuesPerBlock + residuesPerBlock
        ),
      }))
    : [];
  const sequenceRows = zoomedProtein
    ? Array.from({
        length: Math.ceil(sequenceBlocks.length / blocksPerRow),
      }).map((_, rowIndex) => ({
        startBlock: rowIndex * blocksPerRow,
        endBlock: Math.min(sequenceBlocks.length, rowIndex * blocksPerRow + blocksPerRow),
      }))
    : [];

  useEffect(() => {
    if (zoomedIndex === null) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const setupObserver = async () => {
      let attempts = 0;
      while (!cancelled && !sequenceContainerRef.current && attempts < 60) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        attempts++;
      }
      const container = sequenceContainerRef.current;
      if (!container || cancelled) return;

      const updateBlocksPerRow = () => {
        const availableWidth = container.clientWidth;
        if (availableWidth <= 0) return;
        const nextBlocks = Math.max(
          1,
          Math.floor((availableWidth + blockGapPx) / (blockWidthPx + blockGapPx))
        );
        setBlocksPerRow((prev) => (prev === nextBlocks ? prev : nextBlocks));
      };

      updateBlocksPerRow();
      observer = new ResizeObserver(updateBlocksPerRow);
      observer.observe(container);
    };

    setupObserver();
    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  }, [zoomedIndex, blockGapPx, blockWidthPx]);

  return (
    <div className="container mx-auto p-4">
      <div
        ref={offscreenContainerRef}
        style={{
          width: PROTEIN_CANVAS_SIZE,
          height: PROTEIN_CANVAS_SIZE,
          position: "absolute",
          top: -9999,
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proteins.map((protein, index) => (
          <div
            key={protein.alphafold_id}
            className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all ${
              hoveredProteinId === protein.alphafold_id ? "ring-2 ring-blue-400 ring-offset-2" : ""
            }`}
            onClick={() => handleProteinClick(index)}
            onMouseEnter={() => onProteinHover?.(protein.alphafold_id)}
            onMouseLeave={() => onProteinHover?.(null)}
            ref={(el) => (viewerContainerRefs.current[index] = el)}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-30 rounded-full bg-white/90 p-1 shadow hover:bg-white hidden md:inline-flex"
              onClick={(event) => {
                event.stopPropagation();
                const next = new URLSearchParams(searchParams);
                next.set("uniprot", protein.uniprot_id);
                next.delete("zoomUniprot");
                setSearchParams(next);
                setZoomedIndex(index);
              }}
              aria-label={`Open zoom view for ${protein.name}`}
              title="Open zoom view"
            >
              <Search className="h-4 w-4 text-gray-700" />
            </button>
            {activeViewerIndices.has(index) ? (
              <>
                {hoverLabels.get(index) && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none z-20">
                    {hoverLabels.get(index)}
                  </div>
                )}
                <a
                  href={`https://uniprot.org/uniprot/${protein.uniprot_id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm z-10">
                    {protein.name.length > 30
                      ? protein.name.substring(0, 32) + "..."
                      : protein.name}
                  </div>
                </a>
              </>
            ) : proteinImages[index] ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="w-full h-full">
                    <img
                      src={proteinImages[index]!}
                      alt={`Protein ${protein.alphafold_id}`}
                      className="w-full h-full object-cover"
                    />
                    <a
                      href={`https://uniprot.org/uniprot/${protein.uniprot_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                        {protein.name.length > 30
                          ? protein.name.substring(0, 32) + "..."
                          : protein.name}
                      </div>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>Click to interact with the structure</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full bg-white">
                <img
                  src={proteinEmoji}
                  alt="Loading..."
                  className="w-12 h-12 animate-wiggle mb-4"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog.Root
        open={!isMobile && zoomedIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            const next = new URLSearchParams(searchParams);
            next.delete("uniprot");
            next.delete("zoomUniprot");
            setSearchParams(next);
            setZoomedIndex(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[85vh] w-[92vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-background p-6 shadow-lg focus:outline-none">
            <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
            {zoomedProtein && (
              <>
                <div className="text-left">
                  <Dialog.Title className="text-lg font-semibold">
                    {zoomedProtein.name}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    <span className="mr-3">AF-{zoomedProtein.alphafold_id}</span>
                    <a
                      href={`https://uniprot.org/uniprot/${zoomedProtein.uniprot_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      UniProt {zoomedProtein.uniprot_id}
                    </a>
                  </Dialog.Description>
                </div>

                <div
                  ref={zoomViewerContainerRef}
                  className="relative flex-1 min-h-[320px] rounded-lg border bg-gray-50 cursor-pointer"
                >
                  {zoomHoverLabel && (
                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none z-20">
                      {zoomHoverLabel}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div
                    className="max-h-[32vh] overflow-x-auto overflow-y-auto"
                    onMouseLeave={() => setSequenceHoverIndex(null)}
                    ref={sequenceContainerRef}
                  >
                    <TooltipProvider delayDuration={100}>
                      <div
                        className="flex flex-col gap-4 px-4 py-2"
                        style={{ fontFamily: "monospace" }}
                      >
                        {sequenceRows.map((row) => {
                          const blocks = sequenceBlocks.slice(row.startBlock, row.endBlock);
                          return (
                            <div key={`row-${row.startBlock}`} className="flex flex-col gap-2">
                              <div
                                className="flex items-center text-xs text-muted-foreground"
                                style={{ gap: `${blockGapPx}px` }}
                              >
                                {blocks.map((block) => (
                                  <div
                                    key={`label-${block.start}`}
                                    className="flex justify-between"
                                    style={{ width: `${blockWidthPx}px` }}
                                  >
                                    {block.start === 0 ? <span>1</span> : <span>&nbsp;</span>}
                                    <span>{block.end}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center" style={{ gap: `${blockGapPx}px` }}>
                                {blocks.map((block) => (
                                  <div
                                    key={`block-${block.start}`}
                                    className="inline-flex py-1"
                                    style={{ width: `${blockWidthPx}px`, gap: "4px" }}
                                  >
                                    {zoomedProtein.sequence
                                      .slice(block.start, block.end)
                                      .split("")
                                      .map((char, offset) => {
                                        const index = block.start + offset;
                                        const activation = zoomedProtein.sae_acts[index] ?? 0;
                                        const color =
                                          zoomMaxActivation > 0
                                            ? redColorMapHex(activation, zoomMaxActivation)
                                            : "transparent";
                                        const isActive = activeResidueIndex === index;
                                        return (
                                          <Tooltip key={`${zoomedProtein.alphafold_id}-${index}`}>
                                            <TooltipTrigger>
                                              <span
                                                onMouseEnter={() => setSequenceHoverIndex(index)}
                                                style={{
                                                  backgroundColor: color,
                                                  display: "inline-flex",
                                                  width: "14px",
                                                  height: "18px",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  textAlign: "center",
                                                  lineHeight: "1",
                                                  boxShadow: isActive
                                                    ? "0 0 0 2px #2563eb"
                                                    : "0 0 0 1px transparent",
                                                  borderRadius: "3px",
                                                }}
                                              >
                                                {char}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              Position: {index + 1}
                                              <br />
                                              SAE Activation: {activation}
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
});

export default MolstarMulti;
