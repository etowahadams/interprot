import { useState, useEffect, useRef, useMemo } from "react";
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
import {
  ProteinActivationsData,
  redColorMapRGB,
  redColorMapHex,
  createMolstarSpec,
  parseMolstarLabel,
} from "@/utils.ts";
import proteinEmoji from "../protein.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { StructureCache, PDBID } from "@/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PDBStructureViewerProps {
  viewerId: string;
  proteinActivationsData: ProteinActivationsData;
  onLoad?: () => void;
}

const PDBStructureViewer = ({
  viewerId,
  proteinActivationsData,
  onLoad,
}: PDBStructureViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Bidirectional hover tracking
  const [structureHoverIndex, setStructureHoverIndex] = useState<number | null>(null);
  const [sequenceHoverIndex, setSequenceHoverIndex] = useState<number | null>(null);

  // Selected chain tab
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);

  const pluginRef = useRef<PluginContext | null>(null);
  const structureRef = useRef<Structure | null>(null);
  const residueIndexBySeqIdRef = useRef<Map<string, Map<number, number>>>(new Map());
  const residueLociCacheRef = useRef<Map<string, Map<number, StructureElement.Loci>>>(new Map());

  const createResidueColorTheme = (
    chainActivations: { [key: string]: number[] },
    name = "residue-colors"
  ) => {
    const maxValue = Math.max(...Object.values(chainActivations).flatMap((values) => values));

    // Define chain colors with very faint versions
    const chainColors = new Map<string, Color>();
    const defaultChainColors = [
      Color(0xdce6f1), // faint blue
      Color(0xfce8d5), // faint orange
      Color(0xe5f0e5), // faint green
      Color(0xebe5f0), // faint purple
      Color(0xeae5e3), // faint brown
      Color(0xf9ebf5), // faint pink
      Color(0xebebeb), // faint gray
    ];

    return CustomElementProperty.create({
      label: "Residue Colors",
      name,
      getData(model: Model) {
        const map = new Map<ElementIndex, { residueIdx: number; chainId: string }>();
        const { chains, residues, residueAtomSegments, chainAtomSegments } = model.atomicHierarchy;

        // Map each atom to its residue's sequence position and chain.
        // We use auth_seq_id (PDB residue number) to index into the activation array,
        // since the activations are indexed by canonical sequence position (1-based in PDB).
        for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
          const residueIdx = residueAtomSegments.index[i];
          const chainIdx = chainAtomSegments.index[i];
          const chainId = chains.auth_asym_id.value(chainIdx);
          // Use the PDB residue number (auth_seq_id) to get the sequence position.
          // Subtract 1 to convert from 1-based PDB numbering to 0-based array indexing.
          const seqId = residues.auth_seq_id.value(residueIdx);
          const sequenceIndex = seqId - 1;

          map.set(i as ElementIndex, {
            residueIdx: sequenceIndex,
            chainId,
          });
        }
        return { value: map };
      },
      coloring: {
        getColor(p: { residueIdx: number; chainId: string }) {
          const { residueIdx, chainId } = p;
          const activations = chainActivations[chainId];

          // If there is no activation, use a faint default color of the chain.
          if (!activations || !activations[residueIdx]) {
            if (!chainColors.has(chainId)) {
              const colorIndex = chainColors.size % defaultChainColors.length;
              chainColors.set(chainId, defaultChainColors[colorIndex]);
            }
            return chainColors.get(chainId)!;
          }

          // Otherwise, use the activation value to color the residue.
          const color =
            maxValue > 0 ? redColorMapRGB(activations[residueIdx], maxValue) : [255, 255, 255];
          return Color.fromRgb(color[0], color[1], color[2]);
        },
        defaultColor: Color(0xffffff),
      },
      getLabel() {
        return "Activation colors";
      },
    });
  };

  // Parse residue info (index and chain) from Molstar hover label
  const parseResidueInfoFromLabel = (
    label: string | null
  ): { index: number; chainId: string } | null => {
    if (!label) return null;
    // Parse format like "ALA 42" or "ALA 42 | Chain A"
    const match = label.match(/([A-Z]{3})\s+(\d+)(?:\s*\|\s*Chain\s+([A-Za-z0-9]+))?/i);
    if (!match) return null;
    const residueNumber = Number(match[2]);
    const chainId = match[3] || null;
    if (Number.isNaN(residueNumber)) return null;
    return { index: residueNumber - 1, chainId: chainId || "" };
  };

  // Build residue index maps for all chains: chainId -> (seqId -> residueIndex)
  const buildResidueIndexMaps = (structure: Structure): Map<string, Map<number, number>> => {
    const chainMaps = new Map<string, Map<number, number>>();
    const model = structure.models[0];
    if (!model) return chainMaps;

    const { chains, residues, residueAtomSegments, chainAtomSegments } = model.atomicHierarchy;

    for (let rI = 0, _rI = residues._rowCount; rI < _rI; rI++) {
      // Get the chain ID for this residue
      const atomOffset = residueAtomSegments.offsets[rI];
      const chainIdx = chainAtomSegments.index[atomOffset];
      const chainId = chains.auth_asym_id.value(chainIdx);
      const seqId = residues.auth_seq_id.value(rI);

      if (!chainMaps.has(chainId)) {
        chainMaps.set(chainId, new Map());
      }
      const chainMap = chainMaps.get(chainId)!;
      if (!chainMap.has(seqId)) {
        chainMap.set(seqId, rI);
      }
    }
    return chainMaps;
  };

  // Get Molstar loci for highlighting a specific residue in a chain
  const getResidueLoci = (
    structure: Structure,
    residueIndex: number,
    chainId: string
  ): StructureElement.Loci => {
    const elements: StructureElement.Loci["elements"][number][] = [];

    for (const unit of structure.units) {
      if (!Unit.isAtomic(unit)) continue;

      // Check if this unit belongs to the target chain
      const model = unit.model;
      const { chains, chainAtomSegments } = model.atomicHierarchy;
      const unitChainIdx = chainAtomSegments.index[unit.elements[0]];
      const unitChainId = chains.auth_asym_id.value(unitChainIdx);
      if (unitChainId !== chainId) continue;

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

  // Group chains by sequence (like FullSeqsViewer)
  const groupedChains = useMemo(() => {
    const groups = new Map<
      string,
      { ids: string[]; chain: (typeof proteinActivationsData.chains)[0] }
    >();

    proteinActivationsData.chains.forEach((chain) => {
      const existing = groups.get(chain.sequence);
      if (existing) {
        existing.ids.push(chain.id);
      } else {
        groups.set(chain.sequence, { ids: [chain.id], chain });
      }
    });

    return Array.from(groups.values());
  }, [proteinActivationsData.chains]);

  // Initialize selected chain to first chain
  useEffect(() => {
    if (groupedChains.length > 0 && !selectedChainId) {
      setSelectedChainId(groupedChains[0].ids[0]);
    }
  }, [groupedChains, selectedChainId]);

  // Get current chain data based on selected tab
  const currentChainGroup = useMemo(() => {
    return groupedChains.find((g) => g.ids.includes(selectedChainId || ""));
  }, [groupedChains, selectedChainId]);

  // Calculate max activation for color scaling
  const maxActivation = useMemo(() => {
    return Math.max(...proteinActivationsData.chains.flatMap((chain) => chain.activations), 0);
  }, [proteinActivationsData.chains]);

  // Combined active residue index (sequence hover takes priority)
  const activeResidueIndex = sequenceHoverIndex ?? structureHoverIndex;

  useEffect(() => {
    const getStructure = async (pdbId: PDBID) => {
      const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.pdb`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDB structure: ${response.status}`);
      }
      return await response.text();
    };

    const renderViewer = async (pdbData: string) => {
      // Wait for the element to be available in the DOM
      const waitForElement = () => {
        return new Promise<HTMLElement>((resolve, reject) => {
          const element = document.getElementById(viewerId);
          if (element) {
            resolve(element);
            return;
          }

          const observer = new MutationObserver(() => {
            const element = document.getElementById(viewerId);
            if (element) {
              observer.disconnect();
              resolve(element);
            }
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
          });

          setTimeout(() => {
            observer.disconnect();
            reject(new Error("Structure viewer element not found after timeout"));
          }, 5000);
        });
      };

      const container = await waitForElement();
      container.innerHTML = "";

      const canvas = document.createElement("canvas");
      container.appendChild(canvas);

      const plugin = new PluginContext(createMolstarSpec());
      pluginRef.current = plugin;

      await plugin.init();
      plugin.initViewer(canvas, container as HTMLDivElement);

      // Enable residue-level hover labels and bidirectional highlighting
      plugin.managers.interactivity.setProps({ granularity: "residue" });
      const hasMultipleChains = proteinActivationsData.chains.length > 1;
      plugin.behaviors.labels.highlight.subscribe(({ labels }) => {
        const label =
          labels.length > 0 ? parseMolstarLabel(String(labels[0]), hasMultipleChains) : null;
        setHoverLabel(label);

        // Parse residue info for bidirectional hover
        const residueInfo = parseResidueInfoFromLabel(label);
        if (residueInfo) {
          setStructureHoverIndex(residueInfo.index);
          // Auto-switch tabs when hovering over a different chain
          if (residueInfo.chainId && residueInfo.chainId !== selectedChainId) {
            const group = groupedChains.find((g) => g.ids.includes(residueInfo.chainId));
            if (group) {
              setSelectedChainId(group.ids[0]);
            }
          }
        } else {
          setStructureHoverIndex(null);
        }
      });

      const themeName = Math.random().toString(36).substring(7);
      const ResidueColorTheme = createResidueColorTheme(
        Object.fromEntries(
          proteinActivationsData.chains.map((chain) => [chain.id, chain.activations])
        ),
        themeName
      );
      plugin.representation.structure.themes.colorThemeRegistry.add(
        ResidueColorTheme.colorThemeProvider!
      );

      try {
        const blob = new Blob([pdbData], { type: "text/plain" });
        const blobUrl = URL.createObjectURL(blob);
        const structureData = await plugin.builders.data.download({
          url: blobUrl,
          isBinary: false,
          label: "Structure",
        });
        URL.revokeObjectURL(blobUrl);

        const trajectory = await plugin.builders.structure.parseTrajectory(structureData, "pdb");
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");

        plugin.dataTransaction(async () => {
          for (const s of plugin.managers.structure.hierarchy.current.structures) {
            await plugin.managers.structure.component.updateRepresentationsTheme(s.components, {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              color: ResidueColorTheme.propertyProvider.descriptor.name as any,
            });
          }
        });

        // Store structure reference and build residue index maps for bidirectional hover
        const loadedStructure =
          plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
        if (loadedStructure) {
          structureRef.current = loadedStructure;
          residueIndexBySeqIdRef.current = buildResidueIndexMaps(loadedStructure);
          residueLociCacheRef.current = new Map();
        }
      } catch (error) {
        console.error("Error loading structure:", error);
        setError("An error occurred while loading the structure.");
      }
    };

    const renderStructure = async () => {
      setIsLoading(true);
      if (!proteinActivationsData.pdbId) throw new Error("No PDB ID provided");
      try {
        const pdbData =
          StructureCache[proteinActivationsData.pdbId] ||
          (await getStructure(proteinActivationsData.pdbId));
        StructureCache[proteinActivationsData.pdbId] = pdbData;
        renderViewer(pdbData);
      } catch (error) {
        console.error("Error loading structure:", error);
        setError("An error occurred while loading the structure from PDB.");
      }
    };

    if (!proteinActivationsData.pdbId || proteinActivationsData.chains.length === 0) {
      onLoad?.();
      return;
    }
    renderStructure().finally(() => {
      setIsLoading(false);
      onLoad?.();
    });

    return () => {
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }
    };
  }, [proteinActivationsData, onLoad, viewerId]);

  // Sequence → Structure hover: highlight residue in 3D when hovering sequence
  useEffect(() => {
    const plugin = pluginRef.current;
    const structure = structureRef.current;
    if (!plugin || !structure || !selectedChainId) return;

    if (sequenceHoverIndex === null) {
      plugin.managers.interactivity.lociHighlights.clearHighlights();
      return;
    }

    const seqId = sequenceHoverIndex + 1; // Convert to 1-based

    // Get or create loci cache for this chain
    if (!residueLociCacheRef.current.has(selectedChainId)) {
      residueLociCacheRef.current.set(selectedChainId, new Map());
    }
    const chainLociCache = residueLociCacheRef.current.get(selectedChainId)!;

    let loci = chainLociCache.get(seqId);
    if (!loci) {
      const chainResidueMap = residueIndexBySeqIdRef.current.get(selectedChainId);
      if (!chainResidueMap) return;

      const residueIndex = chainResidueMap.get(seqId);
      if (residueIndex === undefined) return;

      loci = getResidueLoci(structure, residueIndex, selectedChainId);
      chainLociCache.set(seqId, loci);
    }

    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci });
  }, [sequenceHoverIndex, selectedChainId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <img src={proteinEmoji} alt="Loading..." className="w-12 h-12 animate-wiggle mb-4" />
      </div>
    );
  }
  return (
    <div className="relative flex flex-col gap-4">
      {/* 3D Structure Viewer */}
      {!error && (
        <div
          id={viewerId}
          className="relative"
          style={{
            width: "100%",
            height: error ? 0 : isMobile ? 300 : 400,
          }}
        >
          {hoverLabel && (
            <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none z-20">
              {hoverLabel}
            </div>
          )}
        </div>
      )}

      {/* Sequence Viewer with Tabs */}
      {!error && currentChainGroup && (
        <div className="rounded-lg border bg-white p-3">
          {/* Tabs for chain selection */}
          {groupedChains.length > 1 && (
            <Tabs value={selectedChainId || ""} onValueChange={setSelectedChainId} className="mb-3">
              <TabsList className="flex-wrap h-auto gap-1">
                {groupedChains.map(({ ids }) => (
                  <TabsTrigger key={ids.join(",")} value={ids[0]} className="text-xs">
                    Chain {ids.join(", ")}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Single chain label when only one chain */}
          {groupedChains.length === 1 && groupedChains[0].ids[0] !== "Unknown" && (
            <div className="font-medium mb-2 text-sm">Chain {groupedChains[0].ids.join(", ")}</div>
          )}

          {/* Sequence display */}
          <div className="overflow-x-auto" onMouseLeave={() => setSequenceHoverIndex(null)}>
            <TooltipProvider delayDuration={100}>
              <div
                className="flex flex-wrap gap-0.5"
                style={{ fontFamily: "monospace", fontSize: "12px" }}
              >
                {currentChainGroup.chain.sequence.split("").map((char, index) => {
                  const activation = currentChainGroup.chain.activations[index] ?? 0;
                  const color =
                    maxActivation > 0 ? redColorMapHex(activation, maxActivation) : "transparent";
                  const isActive = activeResidueIndex === index;

                  return (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <span
                          onMouseEnter={() => setSequenceHoverIndex(index)}
                          style={{
                            backgroundColor: color,
                            display: "inline-flex",
                            width: "12px",
                            height: "16px",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: isActive ? "0 0 0 2px #2563eb" : "none",
                            borderRadius: "2px",
                          }}
                        >
                          {char}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          Position: {index + 1}
                          <br />
                          SAE Activation: {activation.toFixed(2)}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        </div>
      )}

      {error && <small className="text-red-500">{error}</small>}
    </div>
  );
};

export default PDBStructureViewer;
