import { useEffect } from "react";
import { residueColor } from "../utils";

interface MolstarViewerProps {
  alphafold_id: string;
  activation_list: Array<number>;
  width?: string;
  height?: string;
}

const MolstarViewer = ({ alphafold_id, activation_list, width = '400px', height = '400px' }: MolstarViewerProps) => {
  useEffect(() => {
    const loadMolstarPlugin = () => {
      // Create plugin instance and set options after script loads
      // @ts-expect-error
      const viewerInstance = new PDBeMolstarPlugin();

      const options = {
        customData: {
          url: `https://alphafold.ebi.ac.uk/files/AF-${alphafold_id}-F1-model_v4.cif`,
          format: "cif",
        },
        alphafoldView: false,
        bgColor: { r: 255, g: 255, b: 255 },
        hideControls: true,
        hideCanvasControls: ["selection", "animation", "controlToggle", "controlInfo"],
        sequencePanel: true,
        landscape: true,
      };

      const viewerContainer = document.getElementById(`viewer-${alphafold_id}`);
      viewerInstance.render(viewerContainer, options);

      // Listen for the 'load' event
      viewerInstance.events.loadComplete.subscribe(() => {
        viewerInstance.visual.select({
          data: residueColor(activation_list),
          nonSelectedColor: "#ffffff",
        });
      });
    };

    // Check if the script is already loaded
    const scriptId = "molstar-script";
    let script = document.getElementById(scriptId);

    if (!script) {
      // Dynamically load the Molstar script if not already loaded
      script = document.createElement("script");
      script.id = scriptId;
      // @ts-expect-error
      script.src = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
      script.onload = loadMolstarPlugin;
      document.body.appendChild(script);
    } else {
      // Script is already loaded, directly initialize the viewer
      loadMolstarPlugin();
    }

    // Cleanup script on unmount
    return () => {
      // You may not want to remove the script, but if necessary, you can do so
      // document.body.removeChild(script);
    };
  }, [alphafold_id, activation_list]);

  return (
    <div
      id={`viewer-${alphafold_id}`}
      style={{
        width, // Width and height are required
        height,
        position: "relative",
      }}
    ></div>
  );
};

export default MolstarViewer;
