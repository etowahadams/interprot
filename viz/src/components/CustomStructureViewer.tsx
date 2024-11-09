import { useState, useEffect, useRef } from "react";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import { Model, ElementIndex } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import { redColorMapRGB } from "@/utils.ts";
import proteinEmoji from "../protein.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { StructureCache } from "@/utils";

interface CustomStructureViewerProps {
  viewerId: string;
  seq: string;
  pdbId?: string;
  activations: number[];
  onLoad?: () => void;
}

const CustomStructureViewer = ({
  viewerId,
  seq,
  pdbId,
  activations,
  onLoad,
}: CustomStructureViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [foldedWithESM, setFoldedWithESM] = useState(false);
  const isMobile = useIsMobile();

  const pluginRef = useRef<PluginContext | null>(null);

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
    const getStructure = async (sequence: string) => {
      if (pdbId) {
        const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.pdb`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDB structure: ${response.status}`);
        }
        const pdbData = await response.text();
        return pdbData;
      }

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
      setFoldedWithESM(true);
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

      const plugin = new PluginContext(DefaultPluginSpec());
      pluginRef.current = plugin;

      await plugin.init();
      plugin.initViewer(canvas, container as HTMLDivElement);

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
              color: ResidueColorTheme.propertyProvider.descriptor.name as any,
            });
          }
        });
      } catch (error) {
        console.error("Error loading structure:", error);
        setError("An error occurred while loading the structure.");
      }
    };

    const renderStructure = async () => {
      setIsLoading(true);
      try {
        const pdbData = StructureCache[seq] || (await getStructure(seq));
        StructureCache[seq] = pdbData;
        renderViewer(pdbData);
      } catch (error) {
        console.error("Error folding sequence:", error);
        setError("An error occurred while folding the sequence with ESMFold.");
      }
    };

    if (!seq || !activations || activations.length === 0) {
      onLoad?.();
      return;
    }
    if (seq.length > 400) {
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
  }, [seq, activations, onLoad, viewerId]);

  if (!seq || activations.length === 0) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <img src={proteinEmoji} alt="Loading..." className="w-12 h-12 animate-wiggle mb-4" />
      </div>
    );
  }
  return (
    <div>
      {!error && (
        <div
          id={viewerId}
          style={{
            width: "100%",
            height: warning || error ? 0 : isMobile ? 300 : 400,
          }}
        />
      )}
      {foldedWithESM && <small>Structured generated with ESMFold</small>}
      {warning && <small className="text-yellow-500">{warning}</small>}
      {error && <small className="text-red-500">{error}</small>}
    </div>
  );
};

export default CustomStructureViewer;
