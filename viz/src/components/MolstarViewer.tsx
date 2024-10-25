import { useEffect, useState } from "react";
import { residueColor } from "../utils";

interface MolstarViewerProps {
  alphafold_id: string;
  activation_list: Array<number>;
  width?: string;
  height?: string;
  maxRetries?: number;
}

const MolstarViewer = ({
  alphafold_id,
  activation_list,
  width = "400px",
  height = "400px",
  maxRetries = 3,
}: MolstarViewerProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInteractive, setIsInteractive] = useState(false);
  const [viewerInstance, setViewerInstance] = useState<any>(null);

  const captureView = async (instance: any, containerId: string, retryCount = 0) => {
    try {
      const container = document.getElementById(containerId);
      const canvas = container?.querySelector("canvas");

      if (!canvas) {
        if (retryCount < maxRetries) {
          console.log(`Attempt ${retryCount + 1}: Canvas not found, retrying in 1 second...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return captureView(instance, containerId, retryCount + 1);
        }
        throw new Error("Canvas element not found after max retries");
      }

      const dataUrl = canvas.toDataURL("image/png");

      if (dataUrl === "data:," || dataUrl === "data:image/png;base64,") {
        if (retryCount < maxRetries) {
          console.log(`Attempt ${retryCount + 1}: Empty canvas, retrying in 1 second...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return captureView(instance, containerId, retryCount + 1);
        }
        throw new Error("Failed to capture valid image data after max retries");
      }

      setImageUrl(dataUrl);
      setIsLoading(false);
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Attempt ${retryCount + 1}: Failed to capture view, retrying in 1 second...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return captureView(instance, containerId, retryCount + 1);
      }
      console.error("Error capturing view after all retries:", error);
      setIsLoading(false);
    }
  };

  const initializeViewer = (container: HTMLElement, isOffscreen = false) => {
    // @ts-expect-error
    const instance = new PDBeMolstarPlugin();

    const options = {
      customData: {
        url: `https://alphafold.ebi.ac.uk/files/AF-${alphafold_id}-F1-model_v4.cif`,
        format: "cif",
      },
      alphafoldView: false,
      bgColor: { r: 255, g: 255, b: 255 },
      hideControls: true,
      hideCanvasControls: ["selection", "animation", "controlToggle", "controlInfo"],
      sequencePanel: false,
      landscape: true,
    };

    instance.render(container, options);
    return instance;
  };

  useEffect(() => {
    const loadMolstarPlugin = () => {
      if (isInteractive) {
        // Initialize interactive viewer
        const container = document.getElementById(`viewer-${alphafold_id}`);
        if (container) {
          const instance = initializeViewer(container, false);
          setViewerInstance(instance);

          instance.events.loadComplete.subscribe(() => {
            instance.visual.select({
              data: residueColor(activation_list),
              nonSelectedColor: "#ffffff",
            });
          });
        }
      } else {
        // Initialize off-screen viewer for image capture
        const offscreenContainer = document.createElement("div");
        const containerId = `molstar-container-${alphafold_id}`;
        offscreenContainer.id = containerId;
        offscreenContainer.style.position = "absolute";
        offscreenContainer.style.left = "-9999px";
        offscreenContainer.style.width = width;
        offscreenContainer.style.height = height;
        document.body.appendChild(offscreenContainer);

        const instance = initializeViewer(offscreenContainer, true);

        instance.events.loadComplete.subscribe(() => {
          instance.visual.select({
            data: residueColor(activation_list),
            nonSelectedColor: "#ffffff",
          });

          setTimeout(async () => {
            await captureView(instance, containerId);
            if (document.getElementById(containerId)) {
              document.body.removeChild(offscreenContainer);
            }
          }, 1000);
        });
      }
    };

    const scriptId = "molstar-script";
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      // @ts-expect-error
      script.src = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
      script.onload = loadMolstarPlugin;
      document.body.appendChild(script);
    } else {
      loadMolstarPlugin();
    }

    return () => {
      if (viewerInstance) {
        viewerInstance.dispose();
      }
      const containerId = `molstar-container-${alphafold_id}`;
      const container = document.getElementById(containerId);
      if (container) {
        document.body.removeChild(container);
      }
    };
  }, [alphafold_id, activation_list, width, height, maxRetries, isInteractive]);

  const handleClick = () => {
    if (!isInteractive) {
      setIsInteractive(true);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInteractive(false);
  };

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="animate-pulse bg-gray-200 rounded-lg w-full h-full" />
      ) : isInteractive ? (
        <>
          <div
            id={`viewer-${alphafold_id}`}
            style={{
              width: "100%",
              height: "100%",
            }}
          />
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
            title="Return to static view"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={`Protein structure ${alphafold_id}`}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            cursor: "pointer",
          }}
          title="Click to interact"
        />
      ) : (
        <div className="text-red-500">Failed to load visualization after multiple attempts</div>
      )}
    </div>
  );
};

export default MolstarViewer;
