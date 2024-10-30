import React, { useEffect, useRef } from "react";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import { Model, ElementIndex } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import { redColorMapRGB } from "@/utils";

interface MolstarViewerProps {
  cifData: File | string;
  colors: number[]; // Array of values between 0 and 1 for coloring residues
  width?: string;
  height?: string;
  className?: string;
}

const MolstarSimple: React.FC<MolstarViewerProps> = ({
  cifData,
  colors,
  width = "800px",
  height = "600px",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<PluginContext | null>(null);
  // Custom color theme
  const ResidueColorTheme = CustomElementProperty.create({
    label: "Residue Colors",
    name: "residue-colors",
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
        const color = redColorMapRGB(colors[e], 1);
        return colors[e] !== undefined ? Color.fromRgb(color[0], color[1], color[2]) : Color.fromRgb(255, 255, 255); // Default color if out of bounds
      },
      defaultColor: Color(0x777777),
    },
    getLabel(e) {
      return e === 0 ? "Odd stripe" : "Even stripe";
    },
  });

  const initViewer = async (element: HTMLDivElement) => {
    const canvas = document.createElement("canvas");
    element.appendChild(canvas);

    const spec = DefaultPluginSpec();
    const plugin = new PluginContext(spec);
    await plugin.init();
    plugin.initViewer(canvas, element);

    plugin.representation.structure.themes.colorThemeRegistry.add(
      ResidueColorTheme.colorThemeProvider!
    );
    return plugin;
  };

  const loadStructure = async (plugin: PluginContext, data: File | string) => {
    try {
      let structureData;

      if (typeof data === "string") {
        structureData = await plugin.builders.data.download({
          url: data,
          isBinary: data.endsWith(".bcif"),
        });
      } else {
        const arrayBuffer = await data.arrayBuffer();
        structureData = await plugin.builders.data.rawData({
          data: arrayBuffer,
        });
      }

      const trajectory = await plugin.builders.structure.parseTrajectory(structureData, "mmcif");

      const preset = await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");

      plugin.dataTransaction(async () => {
        for (const s of plugin.managers.structure.hierarchy.current.structures) {
          await plugin.managers.structure.component.updateRepresentationsTheme(s.components, {
            color: ResidueColorTheme.propertyProvider.descriptor.name as any,
          });
        }
      });

      return preset;
    } catch (error) {
      console.error("Error loading structure:", error);
      throw error;
    }
  };

  useEffect(() => {
    const setupViewer = async () => {
      if (!containerRef.current) return;

      try {
        if (!pluginRef.current) {
          pluginRef.current = await initViewer(containerRef.current);
        }

        await loadStructure(pluginRef.current, cifData);
      } catch (error) {
        console.error("Error setting up viewer:", error);
      }
    };

    setupViewer();

    return () => {
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }
    };
  }, [cifData, colors]);

  return <div ref={containerRef} className={className} style={{ width, height }} />;
};

export default MolstarSimple;
