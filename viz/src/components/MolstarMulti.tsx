import React, { useEffect, useRef, useState } from "react";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import { Model, ElementIndex } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import { redColorMapRGB } from "@/utils";

interface ProteinData {
  alphafold_id: string;
  tokens_acts_list: Array<number>;
}

interface MolstarViewerProps {
  proteins: ProteinData[];
}

const PROTEIN_SIZE = 300; // Size of each protein viewer in pixels

const MolstarMulti: React.FC<MolstarViewerProps> = ({ proteins }) => {
  const [proteinImages, setProteinImages] = useState<string[]>([]);
  const pluginRef = useRef<PluginContext | null>(null);
  const offscreenContainerRef = useRef<HTMLDivElement>(null);

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

  const loadStructure = async (plugin: PluginContext, protein: ProteinData) => {
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

      // Wait for the scene to render
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Capture the canvas image

      const canvas = offscreenContainerRef.current?.querySelector("canvas");
      if (!canvas) throw new Error("Canvas not found");
      const imageUrl = canvas.toDataURL("image/png");
      return imageUrl;
    } catch (error) {
      console.error("Error loading structure:", error);
      throw error;
    }
  };

  const renderProteins = async (proteins: ProteinData[]) => {
    if (!offscreenContainerRef.current) return;

    setProteinImages([]);
    if (!pluginRef.current) {
      console.warn("init viewer");
      pluginRef.current = await initViewer(offscreenContainerRef.current);
    }
    const images: string[] = [];

    try {
      for (const protein of proteins) {
        const imageUrl = await loadStructure(pluginRef.current, protein);
        images.push(imageUrl);

        // Clean up previous structure
        await pluginRef.current.clear();
      }

      setProteinImages(images);

      // Clean up the plugin after all proteins are processed
      // if (pluginRef.current) {
      //   pluginRef.current.dispose();
      //   pluginRef.current = null;
      // }
    } catch (error) {
      console.error("Error rendering proteins:", error);
    }
  };

  useEffect(() => {
    renderProteins(proteins);
    // return () => {
    //   if (pluginRef.current) {
    //     pluginRef.current.dispose();
    //     pluginRef.current = null;
    //   }
    // };
  }, [proteins]);

  return (
    <div className="container mx-auto p-4">
      {/* Hidden container for rendering */}
      <div
        ref={offscreenContainerRef}
        // className="hidden"
        style={{ width: PROTEIN_SIZE, height: PROTEIN_SIZE, position: "absolute", top: -9999 }}
      />

      {/* Grid display of protein images */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proteinImages.map((imageUrl, index) => (
          <div
            key={proteins[index].alphafold_id}
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
          >
            <img
              src={imageUrl}
              alt={`Protein ${proteins[index].alphafold_id}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-sm">
              {proteins[index].alphafold_id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MolstarMulti;
