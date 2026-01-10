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
import proteinEmoji from "../protein.png";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AminoAcidSequence,
  ProteinActivationsData,
  StructureCache,
  redColorMapRGB,
  redColorMapHex,
  createMolstarSpec,
  parseMolstarLabel,
} from "@/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomStructureViewerProps {
  viewerId: string;
  proteinActivationsData: ProteinActivationsData;
  onLoad?: () => void;
}

const CustomStructureViewer = ({
  viewerId,
  proteinActivationsData,
  onLoad,
}: CustomStructureViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Bidirectional hover tracking
  const [structureHoverIndex, setStructureHoverIndex] = useState<number | null>(null);
  const [sequenceHoverIndex, setSequenceHoverIndex] = useState<number | null>(null);

  const pluginRef = useRef<PluginContext | null>(null);
  const structureRef = useRef<Structure | null>(null);
  const residueIndexBySeqIdRef = useRef<Map<number, number>>(new Map());
  const residueLociCacheRef = useRef<Map<number, StructureElement.Loci>>(new Map());

  // Assume there is only one chain for a user inputted protein
  const { sequence, activations } = proteinActivationsData.chains[0];

  // Combined active residue index (sequence hover takes priority)
  const activeResidueIndex = sequenceHoverIndex ?? structureHoverIndex;

  // Calculate max activation for color scaling
  const maxActivation = useMemo(() => {
    return Math.max(...activations, 0);
  }, [activations]);

  // Parse residue index from Molstar hover label
  const parseResidueIndexFromLabel = (label: string | null): number | null => {
    if (!label) return null;
    const match = label.match(/([A-Z]{3})\s+(\d+)/i);
    if (!match) return null;
    const residueNumber = Number(match[2]);
    return Number.isNaN(residueNumber) ? null : residueNumber - 1;
  };

  // Build residue index map: seqId -> residueIndex
  const buildResidueIndexMap = (structure: Structure): Map<number, number> => {
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

  // Get Molstar loci for highlighting a specific residue
  const getResidueLoci = (structure: Structure, residueIndex: number): StructureElement.Loci => {
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

  useEffect(() => {
    const getStructure = async (sequence: AminoAcidSequence) => {
      const response = await fetch("https://api.esmatlas.com/foldSequence/v1/pdb/", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: sequence,
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      const pdbData = await response.text();
      return pdbData;
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
      plugin.behaviors.labels.highlight.subscribe(({ labels }) => {
        const label = labels.length > 0 ? parseMolstarLabel(String(labels[0])) : null;
        setHoverLabel(label);

        // Parse residue info for bidirectional hover
        const residueIndex = parseResidueIndexFromLabel(label);
        setStructureHoverIndex(residueIndex);
      });

      const themeName = Math.random().toString(36).substring(7);
      const ResidueColorTheme = createResidueColorTheme(activations, themeName);
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

        // Store structure reference and build residue index map for bidirectional hover
        const loadedStructure =
          plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
        if (loadedStructure) {
          structureRef.current = loadedStructure;
          residueIndexBySeqIdRef.current = buildResidueIndexMap(loadedStructure);
          residueLociCacheRef.current = new Map();
        }
      } catch (error) {
        console.error("Error loading structure:", error);
        setError("An error occurred while loading the structure.");
      }
    };

    const renderStructure = async () => {
      setIsLoading(true);
      try {
        const pdbData = StructureCache[sequence] || (await getStructure(sequence));
        StructureCache[sequence] = pdbData;
        renderViewer(pdbData);
      } catch (error) {
        console.error("Error folding sequence:", error);
        setError("An error occurred while folding the sequence with ESMFold.");
      }
    };

    if (!sequence || activations.length === 0) {
      onLoad?.();
      return;
    }
    if (sequence.length > 400) {
      setWarning(
        "No structure generated. We are folding with the ESMFold API which has a limit of 400 residues. If you'd like to see a structure for your sequence, try a shorter sequence."
      );
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
  }, [sequence, activations, onLoad, viewerId]);

  // Sequence → Structure hover: highlight residue in 3D when hovering sequence
  useEffect(() => {
    const plugin = pluginRef.current;
    const structure = structureRef.current;

    if (!plugin || !structure) return;

    if (sequenceHoverIndex === null) {
      plugin.managers.interactivity.lociHighlights.clearHighlights();
      return;
    }

    // seqId is 1-based (sequenceHoverIndex + 1)
    const seqId = sequenceHoverIndex + 1;
    const residueIndex = residueIndexBySeqIdRef.current.get(seqId);
    if (residueIndex === undefined) return;

    // Get loci from cache or compute
    let loci = residueLociCacheRef.current.get(seqId);
    if (!loci) {
      loci = getResidueLoci(structure, residueIndex);
      residueLociCacheRef.current.set(seqId, loci);
    }

    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci });
  }, [sequenceHoverIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <img src={proteinEmoji} alt="Loading..." className="w-12 h-12 animate-wiggle mb-4" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {/* 3D Structure Viewer */}
      {!error && !warning && (
        <>
          <div
            id={viewerId}
            className="relative"
            style={{
              width: "100%",
              height: isMobile ? 300 : 400,
            }}
          >
            {hoverLabel && (
              <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none z-20">
                {hoverLabel}
              </div>
            )}
          </div>
          <small>Structure generated with ESMFold</small>
        </>
      )}

      {/* Warning for long sequences */}
      {warning && <small className="text-yellow-500">{warning}</small>}

      {/* Sequence Viewer - shown even for long sequences without structure */}
      {!error && (
        <div className="rounded-lg border bg-white p-3">
          <div className="overflow-x-auto" onMouseLeave={() => setSequenceHoverIndex(null)}>
            <TooltipProvider delayDuration={100}>
              <div
                className="flex flex-wrap gap-0.5"
                style={{ fontFamily: "monospace", fontSize: "12px" }}
              >
                {sequence.split("").map((char, index) => {
                  const activation = activations[index] ?? 0;
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

export default CustomStructureViewer;
