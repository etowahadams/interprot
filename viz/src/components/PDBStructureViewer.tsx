import { useState, useEffect, useRef } from "react";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { CustomElementProperty } from "molstar/lib/mol-model-props/common/custom-element-property";
import { Model, ElementIndex } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import { ProteinActivationsData, redColorMapRGB } from "@/utils.ts";
import proteinEmoji from "../protein.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { StructureCache, PDBID } from "@/utils";
import { AtomicHierarchy } from "molstar/lib/mol-model/structure/model/properties/atomic/hierarchy";

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
  const isMobile = useIsMobile();

  const pluginRef = useRef<PluginContext | null>(null);

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
        const { chains, residueAtomSegments, chainAtomSegments } = model.atomicHierarchy;

        for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
          const residueIdx = residueAtomSegments.index[i];
          const chainIdx = chainAtomSegments.index[i];
          const chainId = chains.auth_asym_id.value(chainIdx);

          const chainStartResidue = AtomicHierarchy.chainStartResidueIndex(
            { residueAtomSegments, chainAtomSegments },
            chainIdx
          );
          const relativeResidueIdx = residueIdx - chainStartResidue;

          map.set(i as ElementIndex, {
            residueIdx: relativeResidueIdx,
            chainId,
          });
        }
        return { value: map };
      },
      coloring: {
        getColor(p: { residueIdx: number; chainId: string }) {
          const { residueIdx, chainId } = p;
          const activations = chainActivations[chainId];
          if (!activations) {
            if (!chainColors.has(chainId)) {
              const colorIndex = chainColors.size % defaultChainColors.length;
              chainColors.set(chainId, defaultChainColors[colorIndex]);
            }
            return chainColors.get(chainId)!;
          }

          const activation = activations[residueIdx];
          if (!activation) {
            // Same chain-based default coloring
            if (!chainColors.has(chainId)) {
              const colorIndex = chainColors.size % defaultChainColors.length;
              chainColors.set(chainId, defaultChainColors[colorIndex]);
            }
            return chainColors.get(chainId)!;
          }

          const color = maxValue > 0 ? redColorMapRGB(activation, maxValue) : [255, 255, 255];
          return Color.fromRgb(color[0], color[1], color[2]);
        },
        defaultColor: Color(0xffffff),
      },
      getLabel() {
        return "Activation colors";
      },
    });
  };

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

      const plugin = new PluginContext(DefaultPluginSpec());
      pluginRef.current = plugin;

      await plugin.init();
      plugin.initViewer(canvas, container as HTMLDivElement);

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
        const pdbData =
          StructureCache[proteinActivationsData.pdbId] ||
          (await getStructure(proteinActivationsData.pdbId));
        StructureCache[proteinActivationsData.pdbId] = pdbData;
        renderViewer(pdbData);
      } catch (error) {
        console.error("Error folding sequence:", error);
        setError("An error occurred while folding the sequence with ESMFold.");
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
            height: error ? 0 : isMobile ? 300 : 400,
          }}
        />
      )}
      {error && <small className="text-red-500">{error}</small>}
    </div>
  );
};

export default PDBStructureViewer;
