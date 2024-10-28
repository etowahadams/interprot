import { useState, useEffect, useRef, useCallback } from "react";
import SeqViewer from "./SeqViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { sequenceToTokens } from "../utils";
import CustomStructureViewer from "./CustomStructureViewer";

interface CustomSeqPlaygroundProps {
  feature: number;
}

enum PlaygroundState {
  IDLE,
  LOADING_SAE_ACTIVATIONS,
  LOADING_STEERED_SEQUENCE,
}

const CustomSeqPlayground = ({ feature }: CustomSeqPlaygroundProps) => {
  const [customSeqActivations, setCustomSeqActivations] = useState<number[]>([]);
  const [customSeq, setCustomSeq] = useState<string>("");
  const [playgroundState, setViewerState] = useState<PlaygroundState>(PlaygroundState.IDLE);
  const [steeredSeq, setSteeredSeq] = useState<string>("");
  const [steerMultiplier, setSteerMultiplier] = useState(1);
  const [steeredActivations, setSteeredActivations] = useState<number[]>([]);
  const submittedSeqRef = useRef<string>("");

  const fetchSAEActivations = async (seq: string) => {
    try {
      const response = await fetch("https://api.runpod.ai/v2/yk9ehzl3h653vj/runsync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            sequence: seq,
            dim: feature,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const resp = await response.json();
      const data = resp.output.data;
      if (data.tokens_acts_list) {
        return data.tokens_acts_list;
      } else {
        console.error("Unexpected data format:", data);
      }
    } catch (error) {
      console.error("Error fetching activation data:", error);
    }
  };

  const getSteeredSequence = async () => {
    try {
      const response = await fetch("https://api.runpod.ai/v2/jw4etc8vzvp99p/runsync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            sequence: submittedSeqRef.current,
            dim: feature,
            multiplier: steerMultiplier,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const resp = await response.json();
      const data = resp.output.data;
      if (data.steered_sequence) {
        return data.steered_sequence;
      } else {
        console.error("Unexpected data format:", data);
      }
    } catch (error) {
      console.error("Error fetching steered sequence:", error);
    }
  };

  const handleSubmit = async () => {
    setViewerState(PlaygroundState.LOADING_SAE_ACTIVATIONS);
    submittedSeqRef.current = customSeq.toUpperCase();
    const saeActivations = await fetchSAEActivations(submittedSeqRef.current);
    setCustomSeqActivations(saeActivations);
  };

  const handleSteer = async () => {
    setViewerState(PlaygroundState.LOADING_STEERED_SEQUENCE);
    const steeredSeq = await getSteeredSequence();
    setSteeredSeq(steeredSeq);
    setSteeredActivations(await fetchSAEActivations(steeredSeq));
  };

  const onStructureLoad = useCallback(() => setViewerState(PlaygroundState.IDLE), []);

  // Reset playground state whenever user navigates to a new feature
  useEffect(() => {
    setCustomSeqActivations([]);
    setCustomSeq("");
    setViewerState(PlaygroundState.IDLE);
    setSteeredSeq("");
    setSteerMultiplier(1);
    setSteeredActivations([]);
  }, [feature]);

  return (
    <div>
      <div style={{ marginTop: 20 }}>
        <div className="flex overflow-x-auto">
          <Input
            type="text"
            style={{ marginRight: 10 }}
            value={customSeq}
            onChange={(e) => setCustomSeq(e.target.value)}
            placeholder="Enter your own protein sequence"
          />
          <Button
            onClick={handleSubmit}
            disabled={playgroundState === PlaygroundState.LOADING_SAE_ACTIVATIONS || !customSeq}
          >
            {playgroundState === PlaygroundState.LOADING_SAE_ACTIVATIONS ? "Loading..." : "Submit"}
          </Button>
        </div>
      </div>

      {/* Once we have SAE activations, display sequence and structure */}
      {customSeqActivations.length > 0 && (
        <>
          <div className="overflow-x-auto" style={{ margin: 20 }}>
            <SeqViewer
              seq={{
                tokens_acts_list: customSeqActivations,
                tokens_list: sequenceToTokens(submittedSeqRef.current),
              }}
            />
          </div>
          <CustomStructureViewer
            viewerId="custom-viewer"
            seq={submittedSeqRef.current}
            activations={customSeqActivations}
            onLoad={onStructureLoad}
            requireActivations={true}
          />
        </>
      )}

      {/* Once we have SAE activations and the first structure has loaded, render the steering controls */}
      {customSeqActivations.length > 0 &&
        playgroundState !== PlaygroundState.LOADING_SAE_ACTIVATIONS && (
          <div style={{ marginTop: 20 }}>
            <h3 className="text-xl font-bold mb-4">Steering</h3>

            <div className="flex items-center space-x-4">
              <span className="mr-2 whitespace-nowrap">Steer multiplier: {steerMultiplier}</span>
              <Slider
                defaultValue={[1]}
                min={-10}
                max={10}
                step={0.1}
                value={[steerMultiplier]}
                onValueChange={(value) => setSteerMultiplier(value[0])}
              />
              <Button
                onClick={handleSteer}
                disabled={playgroundState === PlaygroundState.LOADING_STEERED_SEQUENCE}
              >
                {playgroundState === PlaygroundState.LOADING_STEERED_SEQUENCE
                  ? "Loading..."
                  : "Steer"}
              </Button>
            </div>

            <div className="overflow-x-auto" style={{ margin: 20 }}>
              <SeqViewer
                seq={{
                  tokens_acts_list: steeredActivations,
                  tokens_list: sequenceToTokens(steeredSeq),
                }}
              />
            </div>
            {steeredActivations.length > 0 && (
              <CustomStructureViewer
                viewerId="steered-viewer"
                seq={steeredSeq}
                activations={steeredActivations}
                onLoad={onStructureLoad}
                requireActivations={false}
              />
            )}
          </div>
        )}
    </div>
  );
};

export default CustomSeqPlayground;
