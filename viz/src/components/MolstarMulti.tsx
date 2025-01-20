import React, { useEffect, useRef, useState } from "react";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { ColorNames } from "molstar/lib/mol-util/color/names";
import { exportHierarchy } from "./export";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { Model, ElementIndex } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import proteinEmoji from "../protein.png";
import { redColorMapRGB } from "@/utils.ts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SeqWithSAEActs } from "./SeqsViewer";

interface MolstarViewerProps {
  proteins: SeqWithSAEActs[];
  maxActivation: number;
}

const PROTEIN_CANVAS_SIZE = 400;

const MolstarMulti: React.FC<MolstarViewerProps> = ({ proteins, maxActivation }) => {
  const [proteinImages, setProteinImages] = useState<(string | null)[]>(
    Array(proteins.length).fill(null)
  );
  const [activeViewerIndices, setActiveViewerIndices] = useState<Set<number>>(new Set());
  const pluginRef = useRef<PluginContext | null>(null);
  const activePluginsRef = useRef<Map<number, PluginContext>>(new Map());
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

  const initViewer = async (element: HTMLDivElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = PROTEIN_CANVAS_SIZE;
    canvas.height = PROTEIN_CANVAS_SIZE;
    element.appendChild(canvas);

    const spec = DefaultPluginSpec();
    const plugin = new PluginContext(spec);
    await plugin.init();
    plugin.initViewer(canvas, element);
    const renderer = plugin.canvas3d!.props.renderer;
    PluginCommands.Canvas3D.SetSettings(plugin, {
      settings: {
        renderer: { ...renderer, backgroundColor: ColorNames.white /* or: 0xff0000 as Color */ },
      },
    });

    return plugin;
  };

  const loadStructure = async (
    plugin: PluginContext,
    protein: SeqWithSAEActs,
    index: number,
    isInteractive: boolean = false
  ) => {
    try {
      const fileName = `https://alphafold.ebi.ac.uk/files/AF-${protein.alphafold_id}-F1-model_v4.cif`;

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

      const maxValue = Math.max(...protein.sae_acts);
      const normalizedActs = protein.sae_acts.map((act) => act / maxActivation);
      const actColors = protein.sae_acts.map((act) => {
        const color = redColorMapRGB(act, maxActivation);
        return color;
      });
      const actColorsHex = actColors.map((color) => {
        return "#" + color.map((c) => c.toString(16).padStart(2, "0")).join("");
      });
      let colorScript = "";
      colorScript += `alphafold fetch ${protein.alphafold_id}\n set bg_color white \ngraphics silhouettes on \nlighting flat\npreset cylinders\n`;
      actColorsHex.forEach((color, i) => {
        colorScript += `color /A:${i + 1} ${color}\n`;
        if (normalizedActs[i] > 0.1) {
          colorScript += `show /A:${i + 1}\n`;
        }
      });
      if (isInteractive) {
        console.log(colorScript);
        console.log(protein.alphafold_id);
      }

      if (!isInteractive) {
        await new Promise((resolve) => setTimeout(resolve, 100));
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
      const plugin = await initViewer(viewerContainer);
      activePluginsRef.current.set(index, plugin);
      await loadStructure(plugin, proteins[index], index, true);

      // exportHierarchy(plugin, { format: "cif" });
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
    renderProteins();
  }, [proteins]);

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
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
            onClick={() => handleProteinClick(index)}
            ref={(el) => (viewerContainerRefs.current[index] = el)}
          >
            {activeViewerIndices.has(index) ? (
              <></>
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
    </div>
  );
};

export default MolstarMulti;
