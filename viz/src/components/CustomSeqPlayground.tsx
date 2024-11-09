import { useState, useEffect, useRef, useCallback } from "react";
import SeqViewer from "./SeqViewer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { isPDBID, getPDBSequence, sequenceToTokens } from "@/utils.ts";
import CustomStructureViewer from "./CustomStructureViewer";
import { getSAEDimActivations, getSteeredSequence } from "@/runpod.ts";
import SeqInput from "./SeqInput";
import { useSearchParams } from "react-router-dom";
import FullSeqViewer from "./FullSeqViewer";

interface CustomSeqPlaygroundProps {
  feature: number;
}

enum PlaygroundState {
  IDLE,
  LOADING_SAE_ACTIVATIONS,
  LOADING_STEERED_SEQUENCE,
}

const initialState = {
  customSeqActivations: [] as number[],
  customSeq: "",
  playgroundState: PlaygroundState.IDLE,
  steeredSeq: "",
  steerMultiplier: 1,
  steeredActivations: [] as number[],
} as const;

const CustomSeqPlayground = ({ feature }: CustomSeqPlaygroundProps) => {
  const [customSeqActivations, setCustomSeqActivations] = useState<number[]>(
    initialState.customSeqActivations
  );
  const [customSeq, setCustomSeq] = useState<string>(initialState.customSeq);
  const [playgroundState, setViewerState] = useState<PlaygroundState>(initialState.playgroundState);
  const [steeredSeq, setSteeredSeq] = useState<string>(initialState.steeredSeq);
  const [steerMultiplier, setSteerMultiplier] = useState<number>(initialState.steerMultiplier);
  const [steeredActivations, setSteeredActivations] = useState<number[]>(
    initialState.steeredActivations
  );
  const submittedSeqRef = useRef<string>("");
  const pdbIdRef = useRef<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();

  // Reset all state when feature changes
  useEffect(() => {
    setCustomSeqActivations(initialState.customSeqActivations);
    setCustomSeq(searchParams.get("seq") || initialState.customSeq);
    setViewerState(initialState.playgroundState);
    setSteeredSeq(initialState.steeredSeq);
    setSteerMultiplier(initialState.steerMultiplier);
    setSteeredActivations(initialState.steeredActivations);
  }, [feature, searchParams]);

  const handleSubmit = useCallback(async () => {
    setViewerState(PlaygroundState.LOADING_SAE_ACTIVATIONS);

    // Reset some states related to downstream actions
    setCustomSeqActivations(initialState.customSeqActivations);
    setSteeredSeq(initialState.steeredSeq);
    setSteerMultiplier(initialState.steerMultiplier);
    setSteeredActivations(initialState.steeredActivations);

    submittedSeqRef.current = customSeq;
    setSearchParams({ seq: submittedSeqRef.current });

    if (isPDBID(submittedSeqRef.current)) {
      pdbIdRef.current = submittedSeqRef.current;
      submittedSeqRef.current = await getPDBSequence(submittedSeqRef.current);
    }

    const saeActivations = await getSAEDimActivations({
      sequence: submittedSeqRef.current,
      dim: feature,
    });
    setCustomSeqActivations(saeActivations);
  }, [customSeq, setSearchParams, feature]);

  // Automatically submit when seq URL param is present
  useEffect(() => {
    const urlSeq = searchParams.get("seq");
    if (urlSeq && customSeq === urlSeq && customSeqActivations.length === 0) {
      handleSubmit();
    }
  }, [searchParams, customSeq, customSeqActivations.length, handleSubmit]);

  const handleSteer = async () => {
    setViewerState(PlaygroundState.LOADING_STEERED_SEQUENCE);

    // Reset some states related to downstream actions
    setSteeredActivations(initialState.steeredActivations);
    setSteeredSeq(initialState.steeredSeq);

    const steeredSeq = await getSteeredSequence({
      sequence: submittedSeqRef.current,
      dim: feature,
      multiplier: steerMultiplier,
    });
    setSteeredSeq(steeredSeq);
    setSteeredActivations(await getSAEDimActivations({ sequence: steeredSeq, dim: feature }));
  };

  const onStructureLoad = useCallback(() => setViewerState(PlaygroundState.IDLE), []);

  return (
    <div>
      <div className="mt-5">
        <SeqInput
          sequence={customSeq}
          setSequence={setCustomSeq}
          onSubmit={handleSubmit}
          loading={playgroundState === PlaygroundState.LOADING_SAE_ACTIVATIONS}
          buttonText="Submit"
        />
      </div>

      {/* Once we have SAE activations, display sequence and structure */}
      {customSeqActivations.length > 0 && (
        <>
          <div className="overflow-x-auto my-4">
            <FullSeqViewer sequence={submittedSeqRef.current} activations={customSeqActivations} />
          </div>
          {customSeqActivations.every((act) => act === 0) && (
            <p className="text-sm mb-2">
              This feature did not activate on your sequence. Try a sequence more similar to the
              ones below.
            </p>
          )}
          <CustomStructureViewer
            viewerId="custom-viewer"
            seq={submittedSeqRef.current}
            pdbId={pdbIdRef.current}
            activations={customSeqActivations}
            onLoad={onStructureLoad}
          />
        </>
      )}

      {/* Once we have SAE activations and the first structure has loaded, render the steering controls */}
      {customSeqActivations.length > 0 &&
        playgroundState !== PlaygroundState.LOADING_SAE_ACTIVATIONS && (
          <div className="mt-5">
            <h3 className="text-xl font-bold mb-4">Sequence Editing via Steering</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="mb-2 text-sm">Steering increases this feature's activation.</p>
              <p className="mb-2 text-sm">
                We were inspired by{" "}
                <a
                  href="https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html#assessing-tour-influence"
                  className="underline"
                >
                  Anthropic's work
                </a>{" "}
                on LLM steering and getting Claude to admit that it is the Golden Gate Bridge.
              </p>
              <p className="mb-2 text-sm">
                Following{" "}
                <a
                  href="https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html#appendix-methods-steering"
                  className="underline"
                >
                  their approach
                </a>
                , we reconstruct the input sequence with the SAE "spliced into" ESM2 at layer 24.
                With steering multiplier N, the SAE activation at every residue in the sequence is
                set to N * (max activation along the sequence). So,
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm mb-2">
                <li>N = 0 {String.fromCharCode(8594)} setting the feature to 0</li>
                <li>
                  N = 1 {String.fromCharCode(8594)} amplifying the feature by setting its activation
                  at each residue to the max activation along the sequence
                </li>
              </ul>
              <p className="text-sm">
                We're experimenting with different methods of steering and will make them available
                soon!
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-grow flex items-center gap-4 w-full">
                  <span className="whitespace-nowrap font-medium min-w-32 m-2">
                    Steer multiplier: {steerMultiplier}
                  </span>
                  <Slider
                    defaultValue={[1]}
                    min={0}
                    max={5}
                    step={0.1}
                    value={[steerMultiplier]}
                    onValueChange={(value) => setSteerMultiplier(value[0])}
                    className="flex-grow"
                  />
                </div>

                <div className="flex gap-2 flex-wrap justify-center">
                  <Button variant="outline" size="sm" onClick={() => setSteerMultiplier(0)}>
                    0x
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSteerMultiplier(1)}>
                    1x
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSteerMultiplier(2)}>
                    2x
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSteerMultiplier(5)}>
                    5x
                  </Button>
                </div>

                {/* Steer button */}
                <Button
                  onClick={handleSteer}
                  disabled={playgroundState === PlaygroundState.LOADING_STEERED_SEQUENCE}
                  className="w-full sm:w-auto min-w-24"
                >
                  {playgroundState === PlaygroundState.LOADING_STEERED_SEQUENCE
                    ? "Loading..."
                    : "Steer"}
                </Button>
              </div>

              {steeredActivations.length > 0 && (
                <>
                  <div className="overflow-x-auto my-4">
                    <SeqViewer
                      seq={{
                        tokens_acts_list: steeredActivations,
                        tokens_list: sequenceToTokens(steeredSeq),
                      }}
                    />
                  </div>
                  <CustomStructureViewer
                    viewerId="steered-viewer"
                    seq={steeredSeq}
                    activations={steeredActivations}
                    onLoad={onStructureLoad}
                  />
                </>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

export default CustomSeqPlayground;
