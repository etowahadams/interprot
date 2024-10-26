import React, { useEffect, useState, useRef } from "react";
import { residueColor } from "../utils";
import proteinEmoji from "../protein.png";

interface ProteinData {
  alphafold_id: string;
  tokens_acts_list: Array<number>;
}

interface MolstarViewerProps {
  proteins: ProteinData[];
}

const MolstarViewer = ({ proteins }: MolstarViewerProps) => {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [activeViewers, setActiveViewers] = useState<Set<number>>(new Set());
  const viewerInstancesRef = useRef<Map<number, any>>(new Map());

  const renderToImage = async (protein: ProteinData) => {
    return new Promise<string>((resolve) => {
      const offscreenContainer = document.createElement("div");
      offscreenContainer.style.width = "400px";
      offscreenContainer.style.height = "400px";
      offscreenContainer.style.position = "absolute";
      offscreenContainer.style.left = "-9999px";
      document.body.appendChild(offscreenContainer);

      // @ts-expect-error
      const viewer = new PDBeMolstarPlugin();
      const options = {
        customData: {
          url: `https://alphafold.ebi.ac.uk/files/AF-${protein.alphafold_id}-F1-model_v4.cif`,
          format: "cif",
        },
        alphafoldView: true,
        bgColor: { r: 255, g: 255, b: 255 },
        hideControls: true,
        hideCanvasControls: ["selection", "animation", "controlToggle", "controlInfo"],
        landscape: true,
      };

      viewer.render(offscreenContainer, options);
      viewer.events.loadComplete.subscribe(() => {
        viewer.visual.select({
          data: residueColor(protein.tokens_acts_list),
          nonSelectedColor: "#ffffff",
        });

        setTimeout(() => {
          const canvas = offscreenContainer.querySelector("canvas");
          if (canvas) {
            const image = canvas.toDataURL("image/png");
            const ctx = canvas.getContext("2d");
            ctx?.reset();
            document.body.removeChild(offscreenContainer);
            resolve(image);
          }
        }, 150);
      });
    });
  };

  const renderSequentially = async (proteins: ProteinData[]) => {
    const images: string[] = [];
    for (const protein of proteins) {
      const image = await renderToImage(protein);
      images.push(image);
      setPreviewImages([...images]); // Update state after each render
    }
    return images;
  };

  const loadMolstarPlugin = (protein: ProteinData, index: number) => {
    if (viewerInstancesRef.current.has(index)) {
      return;
    }

    // @ts-expect-error
    const viewer = new PDBeMolstarPlugin();
    viewerInstancesRef.current.set(index, viewer);

    const options = {
      customData: {
        url: `https://alphafold.ebi.ac.uk/files/AF-${protein.alphafold_id}-F1-model_v4.cif`,
        format: "cif",
      },
      alphafoldView: true,
      bgColor: { r: 255, g: 255, b: 255 },
      hideControls: true,
      hideCanvasControls: ["selection", "animation", "controlToggle", "controlInfo"],
      sequencePanel: true,
      landscape: true,
    };

    const viewerContainer = document.getElementById(`viewer-${index}`);
    viewer.render(viewerContainer, options);

    viewer.events.loadComplete.subscribe(() => {
      viewer.visual.select({
        data: residueColor(protein.tokens_acts_list),
        nonSelectedColor: "#ffffff",
      });
    });
  };

  // Clean up function to destroy viewers and reset state
  const cleanup = () => {
    // Destroy all viewer instances
    viewerInstancesRef.current.forEach((viewer) => {
      if (viewer && typeof viewer.destroy === "function") {
        viewer.destroy();
      }
    });
    viewerInstancesRef.current.clear();
    setActiveViewers(new Set());
    setPreviewImages([]);
  };

  useEffect(() => {
    const scriptId = "molstar-script";
    let script = document.getElementById(scriptId);

    // Clean up previous state when proteins change
    cleanup();

    const initializeViewer = async () => {
      await renderSequentially(proteins);
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      // @ts-expect-error
      script.src = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
      script.onload = initializeViewer;
      document.body.appendChild(script);
    } else {
      initializeViewer();
    }

    // Clean up on unmount
    return cleanup;
  }, [proteins]);

  const handleImageClick = (index: number) => {
    setActiveViewers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        // keep it
      } else {
        newSet.add(index);
        setTimeout(() => loadMolstarPlugin(proteins[index], index), 0);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proteins.map((protein, index) => (
          <div key={protein.alphafold_id} className="relative aspect-square">
            {activeViewers.has(index) ? (
              <div
                id={`viewer-${index}`}
                className="w-full h-full"
                onClick={() => handleImageClick(index)}
              />
            ) : previewImages[index] ? (
              <img
                src={previewImages[index]}
                alt={`Protein ${protein.alphafold_id}`}
                onClick={() => handleImageClick(index)}
                className="w-full h-full object-cover cursor-pointer rounded-lg hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <img
                  src={proteinEmoji}
                  alt="Loading..."
                  className="w-12 h-12 animate-wiggle mb-4"
                />
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              {protein.alphafold_id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MolstarViewer;
