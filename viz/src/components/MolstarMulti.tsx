import React, { useEffect, useRef, useState } from "react";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import { Model, ElementIndex } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import proteinEmoji from "../protein.png";
import { redColorMapRGB } from "@/utils";

interface ProteinData {
  alphafold_id: string;
  tokens_acts_list: Array<number>;
}

interface MolstarViewerProps {
  proteins: ProteinData[];
}

const PROTEIN_SIZE = 300;

const MolstarMulti: React.FC<MolstarViewerProps> = ({ proteins }) => {
  const [proteinImages, setProteinImages] = useState<(string | null)[]>(Array(proteins.length).fill(null));
  const [activeViewerIndices, setActiveViewerIndices] = useState<Set<number>>(new Set());
  const pluginRef = useRef<PluginContext | null>(null);
  const activePluginsRef = useRef<Map<number, PluginContext>>(new Map());
  const offscreenContainerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const createResidueColorTheme = (activationList: number[], name = "residue-colors") => {
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
          const color = redColorMapRGB(activationList[e], 1);
          return activationList[e] !== undefined
            ? Color.fromRgb(color[0], color[1], color[2])
            : Color.fromRgb(255, 255, 255);
        },
        defaultColor: Color(0x777777),
      },
      getLabel(e) {
        return e === 0 ? "Odd stripe" : "Even stripe";
      },
    });
  };

  const initViewer = async (element: HTMLDivElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = PROTEIN_SIZE;
    canvas.height = PROTEIN_SIZE;
    element.appendChild(canvas);

    const spec = DefaultPluginSpec();
    const plugin = new PluginContext(spec);
    await plugin.init();
    plugin.initViewer(canvas, element);

    return plugin;
  };

  const loadStructure = async (plugin: PluginContext, protein: ProteinData, index: number, isInteractive: boolean = false) => {
    try {
      const fileName = `https://alphafold.ebi.ac.uk/files/AF-${protein.alphafold_id}-F1-model_v4.cif`;

      const themeName = Math.random().toString(36).substring(7);
      const ResidueColorTheme = createResidueColorTheme(protein.tokens_acts_list, themeName);
      plugin.representation.structure.themes.colorThemeRegistry.add(
        ResidueColorTheme.colorThemeProvider!
      );

      const structureData = await plugin.builders.data.download({
        url: fileName,
        isBinary: fileName.endsWith(".bcif"),
      });

      const trajectory = await plugin.builders.structure.parseTrajectory(structureData, "mmcif");
      const preset = await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");

      plugin.dataTransaction(async () => {
        for (const s of plugin.managers.structure.hierarchy.current.structures) {
          await plugin.managers.structure.component.updateRepresentationsTheme(s.components, {
            color: ResidueColorTheme.propertyProvider.descriptor.name as any,
          });
        }
      });

      if (!isInteractive) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const canvas = offscreenContainerRef.current?.querySelector("canvas");
        if (!canvas) throw new Error("Canvas not found");
        const imageUrl = canvas.toDataURL("image/png");
        
        setProteinImages(prev => {
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
      setActiveViewerIndices(prev => {
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
    activePluginsRef.current.forEach(plugin => plugin.dispose());
    renderProteins();
  }, [proteins]);

  return (
    <div className="container mx-auto p-4">
      <div
        ref={offscreenContainerRef}
        style={{ width: PROTEIN_SIZE, height: PROTEIN_SIZE, position: "absolute", top: -9999 }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proteins.map((protein, index) => (
          <div
            key={protein.alphafold_id}
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
            onClick={() => handleProteinClick(index)}
            ref={el => viewerContainerRefs.current[index] = el}
          >
            {activeViewerIndices.has(index) ? (
              <></>
            ) : proteinImages[index] ? (
              <>
                <img
                  src={proteinImages[index]!}
                  alt={`Protein ${protein.alphafold_id}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-sm">
                  {protein.alphafold_id}
                </div>
              </>
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