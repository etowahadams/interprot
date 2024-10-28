import { useState, useEffect, useRef } from "react";
import { residueColor } from "../utils";
import proteinEmoji from "../protein.png";

interface CustomStructureViewerProps {
  viewerId: string;
  seq: string;
  activations: number[];
  onLoad?: () => void;
  requireActivations?: boolean;
}

const CustomStructureViewer = ({
  viewerId,
  seq,
  activations,
  onLoad,
  requireActivations = true,
}: CustomStructureViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const ESMFoldCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const foldStructure = async (sequence: string) => {
      const response = await fetch("https://api.esmatlas.com/foldSequence/v1/pdb/", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: sequence,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      return await response.text();
    };

    const createBlobUrl = (data: string) => {
      const blob = new Blob([data], { type: "text/plain" });
      return URL.createObjectURL(blob);
    };

    const renderViewer = (blobUrl: string) => {
      // @ts-expect-error: PDBeMolstarPlugin is not typed
      const viewerInstance = new PDBeMolstarPlugin();
      const options = {
        customData: {
          url: blobUrl,
          format: "pdb",
        },
        alphafoldView: false,
        bgColor: { r: 255, g: 255, b: 255 },
        hideControls: true,
        hideCanvasControls: ["selection", "animation", "controlToggle", "controlInfo"],
        sequencePanel: true,
        landscape: true,
      };
      const viewerContainer = document.getElementById(viewerId);
      viewerInstance.render(viewerContainer, options);

      viewerInstance.events.loadComplete.subscribe(() => {
        viewerInstance.visual.select({
          data: residueColor(activations),
          nonSelectedColor: "#ffffff",
        });
        setMessage("Structure generated with ESMFold.");
      });
    };

    const renderStructure = async () => {
      setIsLoading(true);
      try {
        const pdbData = ESMFoldCache.current[seq] || (await foldStructure(seq));
        ESMFoldCache.current[seq] = pdbData;
        const blobUrl = createBlobUrl(pdbData);
        renderViewer(blobUrl);
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
      setError(
        "No structure generated. We are folding with ESMFold API which has a limit of 400 residues. Please try a shorter sequence."
      );
      onLoad?.();
      return;
    }
    if (requireActivations && activations.every((act) => act === 0)) {
      setError(
        "This feature did not activate on your sequence. Try a sequence more similar to ones below."
      );
      onLoad?.();
      return;
    }
    renderStructure().finally(() => {
      setIsLoading(false);
      onLoad?.();
    });
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
    <>
      {!error && (
        <div
          id={viewerId}
          style={{
            marginTop: 20,
            width: "100%",
            height: 400,
            position: "relative",
          }}
        />
      )}
      {message && <small>{message}</small>}
      {error && <small className="text-red-500">{error}</small>}
    </>
  );
};

export default CustomStructureViewer;
