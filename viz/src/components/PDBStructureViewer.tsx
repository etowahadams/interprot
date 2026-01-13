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
  groupChainsBySequence,
  formatChainIds,
} from "@/utils.ts";
import proteinEmoji from "../protein.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { StructureCache, PDBID } from "@/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PDBStructureViewerProps {
  viewerId: string;
  proteinActivationsData: ProteinActivationsData;
  onLoad?: () => void;
}

/**
 * Creates a Molstar color theme that colors residues by their activation values.
 *
 * Uses label_seq_id - 1 to map structure residues to the canonical sequence position.
 * This is correct because:
 * - The canonical sequence from RCSB (pdbx_seq_one_letter_code_can) includes ALL residues
 * - label_seq_id in the structure corresponds to the 1-based position in this canonical sequence
 * - Disordered residues are missing from the structure but present in the sequence
 */
function createResidueColorTheme(
  chainActivations: { [chainId: string]: number[] },
  name = "residue-colors"
) {
  const maxValue = Math.max(...Object.values(chainActivations).flatMap((v) => v), 0);

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
      const map = new Map<ElementIndex, { seqPos: number; chainId: string }>();
      const { chains, residues, residueAtomSegments, chainAtomSegments } = model.atomicHierarchy;

      for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
        const residueIdx = residueAtomSegments.index[i];
        const chainIdx = chainAtomSegments.index[i];
        const chainId = chains.auth_asym_id.value(chainIdx);

        // Use label_seq_id to get the position in the canonical sequence
        // label_seq_id is 1-based, so subtract 1 for 0-based array index
        const labelSeqId = residues.label_seq_id.value(residueIdx);
        if (!labelSeqId) continue;

        const seqPos = labelSeqId - 1;
        map.set(i as ElementIndex, { seqPos, chainId });
      }
      return { value: map };
    },
    coloring: {
      getColor(p: { seqPos: number; chainId: string }) {
        const { seqPos, chainId } = p;
        const activations = chainActivations[chainId];

        if (!activations || seqPos < 0 || seqPos >= activations.length || !activations[seqPos]) {
          // Use faint chain color for residues without activations
          const chainIds = Object.keys(chainActivations);
          const chainIndex = chainIds.indexOf(chainId);
          return defaultChainColors[chainIndex % defaultChainColors.length];
        }

        const color =
          maxValue > 0 ? redColorMapRGB(activations[seqPos], maxValue) : [255, 255, 255];
        return Color.fromRgb(color[0], color[1], color[2]);
      },
      defaultColor: Color(0xffffff),
    },
    getLabel() {
      return "Activation colors";
    },
  });
}

/**
 * Builds a map from (chainId, seqPos) -> residueIndex for sequence → structure hover.
 * seqPos is 0-indexed (label_seq_id - 1).
 */
function buildSeqPosToResidueMap(model: Model): Map<string, Map<number, number>> {
  const chainMaps = new Map<string, Map<number, number>>();
  const { chains, residues, residueAtomSegments, chainAtomSegments } = model.atomicHierarchy;

  for (let rI = 0, _rI = residues._rowCount; rI < _rI; rI++) {
    const atomOffset = residueAtomSegments.offsets[rI];
    const chainIdx = chainAtomSegments.index[atomOffset];
    const chainId = chains.auth_asym_id.value(chainIdx);

    const labelSeqId = residues.label_seq_id.value(rI);
    if (!labelSeqId) continue;

    const seqPos = labelSeqId - 1;

    if (!chainMaps.has(chainId)) {
      chainMaps.set(chainId, new Map());
    }
    chainMaps.get(chainId)!.set(seqPos, rI);
  }

  return chainMaps;
}

/**
 * Builds a map from (chainId, auth_seq_id) -> seqPos for structure → sequence hover.
 * When Molstar displays a hover label like "GLN 22", the 22 is auth_seq_id.
 * We map this to the 0-indexed sequence position.
 */
function buildAuthSeqIdToSeqPosMap(model: Model): Map<string, Map<number, number>> {
  const chainMaps = new Map<string, Map<number, number>>();
  const { chains, residues, residueAtomSegments, chainAtomSegments } = model.atomicHierarchy;

  for (let rI = 0, _rI = residues._rowCount; rI < _rI; rI++) {
    const atomOffset = residueAtomSegments.offsets[rI];
    const chainIdx = chainAtomSegments.index[atomOffset];
    const chainId = chains.auth_asym_id.value(chainIdx);

    const authSeqId = residues.auth_seq_id.value(rI);
    const labelSeqId = residues.label_seq_id.value(rI);
    if (!authSeqId || !labelSeqId) continue;

    const seqPos = labelSeqId - 1;

    if (!chainMaps.has(chainId)) {
      chainMaps.set(chainId, new Map());
    }
    chainMaps.get(chainId)!.set(authSeqId, seqPos);
  }

  return chainMaps;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Map: chainId -> (seqPos -> residueIndex) for sequence → structure hover
  const seqPosToResidueRef = useRef<Map<string, Map<number, number>>>(new Map());
  // Map: chainId -> (auth_seq_id -> seqPos) for structure → sequence hover
  const authSeqIdToSeqPosRef = useRef<Map<string, Map<number, number>>>(new Map());

  // Track which sequence positions have corresponding structure residues
  const [structurePositions, setStructurePositions] = useState<Map<string, Set<number>>>(new Map());

  // Parse residue info from Molstar hover label
  // Returns the 0-indexed sequence position
  const parseResidueInfoFromLabel = (
    label: string | null
  ): { seqPos: number; chainId: string } | null => {
    if (!label) return null;
    // Parse format like "ALA 42" or "ALA 42 (Chain a)"
    const match = label.match(/([A-Z]{3})\s+(\d+)(?:\s*\(Chain\s+([A-Za-z0-9]+)\))?/i);
    if (!match) return null;
    const authSeqId = Number(match[2]);
    const chainId = match[3] || selectedChainId || "";
    if (Number.isNaN(authSeqId)) return null;

    // Look up the sequence position using auth_seq_id
    const chainMap = authSeqIdToSeqPosRef.current.get(chainId);
    if (!chainMap) return null;
    const seqPos = chainMap.get(authSeqId);
    if (seqPos === undefined) return null;

    return { seqPos, chainId };
  };

  // Get Molstar loci for highlighting a specific residue
  const getResidueLoci = (
    structure: Structure,
    residueIndex: number,
    chainId: string
  ): StructureElement.Loci => {
    const elements: StructureElement.Loci["elements"][number][] = [];

    for (const unit of structure.units) {
      if (!Unit.isAtomic(unit)) continue;

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

  // Group chains by sequence
  const groupedChains = useMemo(() => {
    return groupChainsBySequence(proteinActivationsData.chains);
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
    // Track if effect is still active (component mounted and not re-rendered)
    let isActive = true;

    const getStructure = async (pdbId: PDBID) => {
      const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDB structure: ${response.status}`);
      }
      return await response.text();
    };

    const renderViewer = async (pdbData: string) => {
      // Wait for next frame to ensure container has dimensions
      await new Promise((resolve) => requestAnimationFrame(resolve));

      if (!isActive) return;

      const container = containerRef.current;
      if (!container) return;

      // Clear any existing canvas (from previous render)
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // Get container dimensions and set explicit canvas size for WebGL
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);

      const plugin = new PluginContext(createMolstarSpec());
      pluginRef.current = plugin;

      await plugin.init();

      if (!isActive) {
        plugin.dispose();
        return;
      }

      plugin.initViewer(canvas, container);

      // Enable residue-level hover labels
      plugin.managers.interactivity.setProps({ granularity: "residue" });
      const hasMultipleChains = proteinActivationsData.chains.length > 1;
      plugin.behaviors.labels.highlight.subscribe(({ labels }) => {
        const label =
          labels.length > 0 ? parseMolstarLabel(String(labels[0]), hasMultipleChains) : null;
        setHoverLabel(label);

        const residueInfo = parseResidueInfoFromLabel(label);
        if (residueInfo) {
          setStructureHoverIndex(residueInfo.seqPos);
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

        // Check if still active after data download
        if (!isActive) return;

        const trajectory = await plugin.builders.structure.parseTrajectory(structureData, "mmcif");
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");

        await plugin.dataTransaction(async () => {
          for (const s of plugin.managers.structure.hierarchy.current.structures) {
            await plugin.managers.structure.component.updateRepresentationsTheme(s.components, {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              color: ResidueColorTheme.propertyProvider.descriptor.name as any,
            });
          }
        });

        if (!isActive) return;

        // Build residue mapping indices
        const loadedStructure =
          plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
        if (loadedStructure) {
          structureRef.current = loadedStructure;
          const model = loadedStructure.models[0];
          if (model) {
            const seqPosMap = buildSeqPosToResidueMap(model);
            seqPosToResidueRef.current = seqPosMap;
            authSeqIdToSeqPosRef.current = buildAuthSeqIdToSeqPosMap(model);

            // Build set of positions that exist in structure for each chain
            const positionsMap = new Map<string, Set<number>>();
            for (const [chainId, posMap] of seqPosMap.entries()) {
              positionsMap.set(chainId, new Set(posMap.keys()));
            }
            setStructurePositions(positionsMap);
          }
        }
      } catch (error) {
        console.error("Error loading structure:", error);
        if (isActive) {
          setError("An error occurred while loading the structure.");
        }
      }
    };

    const renderStructure = async () => {
      setIsLoading(true);
      if (!proteinActivationsData.pdbId) throw new Error("No PDB ID provided");
      try {
        const pdbData =
          StructureCache[proteinActivationsData.pdbId] ||
          (await getStructure(proteinActivationsData.pdbId));

        // Check if still active after fetching structure
        if (!isActive) return;

        StructureCache[proteinActivationsData.pdbId] = pdbData;
        await renderViewer(pdbData);
      } catch (error) {
        console.error("Error loading structure:", error);
        if (isActive) {
          setError("An error occurred while loading the structure from PDB.");
        }
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
      // Mark as inactive to prevent any pending async operations from continuing
      isActive = false;
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

    // sequenceHoverIndex is 0-indexed, matching our seqPos
    const chainMap = seqPosToResidueRef.current.get(selectedChainId);
    if (!chainMap) return;

    const residueIndex = chainMap.get(sequenceHoverIndex);
    if (residueIndex === undefined) {
      // This residue is not in the structure (disordered)
      plugin.managers.interactivity.lociHighlights.clearHighlights();
      return;
    }

    const loci = getResidueLoci(structure, residueIndex, selectedChainId);
    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci });
  }, [sequenceHoverIndex, selectedChainId]);

  return (
    <div className="relative flex flex-col gap-4">
      {/* 3D Structure Viewer - always render the container so Molstar can initialize */}
      {!error && (
        <div
          id={viewerId}
          className="relative"
          style={{
            width: "100%",
            height: error ? 0 : isMobile ? 300 : 400,
          }}
        >
          {/* Inner container for Molstar canvas - managed outside React's reconciliation */}
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <img src={proteinEmoji} alt="Loading..." className="w-12 h-12 animate-wiggle" />
            </div>
          )}
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
                    Chain {formatChainIds(ids)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Single chain label when only one chain */}
          {groupedChains.length === 1 && groupedChains[0].ids[0] !== "Unknown" && (
            <div className="font-medium mb-2 text-sm">
              Chain {formatChainIds(groupedChains[0].ids)}
            </div>
          )}

          {/* Fixed info bar - updates on hover */}
          <div className="text-xs text-gray-600 mb-2 h-5 flex items-center gap-3 border-b pb-2">
            {sequenceHoverIndex !== null ? (
              <>
                <span>
                  <span className="text-gray-400">Position:</span>{" "}
                  <span className="font-medium text-gray-900">{sequenceHoverIndex + 1}</span>
                </span>
                <span>
                  <span className="text-gray-400">Residue:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {currentChainGroup.items[0].sequence[sequenceHoverIndex]}
                  </span>
                </span>
                <span>
                  <span className="text-gray-400">SAE Activation:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {(currentChainGroup.items[0].activations[sequenceHoverIndex] ?? 0).toFixed(2)}
                  </span>
                </span>
                {!(
                  structurePositions.get(selectedChainId || "")?.has(sequenceHoverIndex) ?? false
                ) && <span className="text-gray-400 italic">(Not in structure)</span>}
              </>
            ) : (
              <span className="text-gray-400 italic">Hover over a residue to see details</span>
            )}
          </div>

          {/* Sequence display */}
          <div className="overflow-x-auto" onMouseLeave={() => setSequenceHoverIndex(null)}>
            <div
              className="flex flex-wrap gap-0.5 p-0.5"
              style={{ fontFamily: "monospace", fontSize: "12px" }}
            >
              {currentChainGroup.items[0].sequence.split("").map((char, index) => {
                const activation = currentChainGroup.items[0].activations[index] ?? 0;
                const isActive = activeResidueIndex === index;

                // Check if this position exists in the structure
                const chainPositions = structurePositions.get(selectedChainId || "");
                const isInStructure = chainPositions?.has(index) ?? false;

                // Always show activation colors
                const color =
                  maxActivation > 0 ? redColorMapHex(activation, maxActivation) : "transparent";

                return (
                  <span
                    key={index}
                    onMouseEnter={() => setSequenceHoverIndex(index)}
                    style={{
                      backgroundColor: color,
                      display: "inline-flex",
                      width: "12px",
                      height: "16px",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: isInStructure ? "pointer" : "default",
                      boxShadow: isActive && isInStructure ? "0 0 0 2px #2563eb" : "none",
                      borderRadius: "2px",
                      opacity: isInStructure ? 1 : 0.6,
                    }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {error && <small className="text-red-500">{error}</small>}
    </div>
  );
};

export default PDBStructureViewer;
