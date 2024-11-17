import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  isPDBID,
  isProteinSequence,
  AminoAcidSequence,
  ProteinActivationsData,
  constructProteinActivationsDataFromSequence,
  constructProteinActivationsDataFromPDBID,
} from "@/utils.ts";
import CustomStructureViewer from "./CustomStructureViewer";
import { getSAEDimActivations, getSteeredSequence } from "@/runpod.ts";
import SeqInput, { ValidSeqInput } from "./SeqInput";
import { useSearchParams } from "react-router-dom";
import FullSeqsViewer from "./FullSeqsViewer";
import PDBStructureViewer from "./PDBStructureViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomSeqPlaygroundProps {
  feature: number;
}

enum PlaygroundState {
  IDLE,
  LOADING_SAE_ACTIVATIONS,
  LOADING_STEERED_SEQUENCE,
}

const initialState = {
  inputProteinActivations: {} as ProteinActivationsData,
  proteinInput: "",
  playgroundState: PlaygroundState.IDLE,
  steeredSeq: "",
  steerMultiplier: 1,
  steeredActivations: [] as number[],
} as const;

const CustomSeqPlayground = ({ feature }: CustomSeqPlaygroundProps) => {
  // [chainIndex][residueIndex] array to account for the fact that PDB structures may have multiple chains.
  // If user is not inputting a PDB ID, this will always be a 1D array.
  const [inputProteinActivations, setInputProteinActivations] = useState<ProteinActivationsData>(
    initialState.inputProteinActivations
  );
  const [proteinInput, setCustomSeqInput] = useState<string>(initialState.proteinInput);
  const submittedInputRef = useRef<ValidSeqInput | undefined>(undefined);

  const [playgroundState, setViewerState] = useState<PlaygroundState>(initialState.playgroundState);
  const [steeredSeq, setSteeredSeq] = useState<string>(initialState.steeredSeq);
  const [steerMultiplier, setSteerMultiplier] = useState<number>(initialState.steerMultiplier);
  const [steeredActivations, setSteeredActivations] = useState<number[]>(
    initialState.steeredActivations
  );

  const [searchParams, setSearchParams] = useSearchParams();

  // Somewhat hacky way to enable URL <-> state syncing (there's probably a better way):
  // - If URL changes (e.g. user navigates to a new shared link), set this to "url"
  //   and set state to the URL
  // - If the state changes (e.g. user submits a new sequence), set this to "state"
  //   and set the URL
  // Keeping track of this source of update makes it easier in useEffect to distinguish
  // which case we're in and avoid circular updates.
  const lastInputUpdateSource = useRef<"url" | "state" | null>(null);

  const handleSubmit = useCallback(
    async (submittedInput: ValidSeqInput) => {
      lastInputUpdateSource.current = "state";
      setViewerState(PlaygroundState.LOADING_SAE_ACTIVATIONS);

      // Reset some states related to downstream actions
      setInputProteinActivations(initialState.inputProteinActivations);
      setSteeredSeq(initialState.steeredSeq);
      setSteerMultiplier(initialState.steerMultiplier);
      setSteeredActivations(initialState.steeredActivations);

      submittedInputRef.current = submittedInput;
      if (isPDBID(submittedInput)) {
        setInputProteinActivations(
          await constructProteinActivationsDataFromPDBID(submittedInput, feature)
        );
        setSearchParams({ pdb: submittedInput });
      } else {
        setInputProteinActivations(
          await constructProteinActivationsDataFromSequence(submittedInput, feature)
        );
        setSearchParams({ seq: submittedInput });
      }
    },
    [setSearchParams, feature]
  );

  // Reset some states when the user navigates to a new feature
  useEffect(() => {
    setInputProteinActivations(initialState.inputProteinActivations);
    setViewerState(initialState.playgroundState);
    setSteeredSeq(initialState.steeredSeq);
    setSteerMultiplier(initialState.steerMultiplier);
    setSteeredActivations(initialState.steeredActivations);

    if (submittedInputRef.current) {
      handleSubmit(submittedInputRef.current);
    }
  }, [feature, handleSubmit]);

  useEffect(() => {
    const urlPdbId = searchParams.get("pdb");
    const urlSeq = searchParams.get("seq");

    // If the last update was from the URL (e.g. user navigated to a new link), submit the sequence
    // and update the state
    if (lastInputUpdateSource.current !== "state") {
      lastInputUpdateSource.current = "url";
      if (urlPdbId && isPDBID(urlPdbId) && submittedInputRef.current !== urlPdbId) {
        setCustomSeqInput(urlPdbId);
        handleSubmit(urlPdbId);
      } else if (urlSeq && isProteinSequence(urlSeq) && submittedInputRef.current !== urlSeq) {
        setCustomSeqInput(urlSeq);
        handleSubmit(urlSeq);
      }
    }

    lastInputUpdateSource.current = null;
  }, [searchParams, handleSubmit]);

  const handleSteer = async () => {
    setViewerState(PlaygroundState.LOADING_STEERED_SEQUENCE);

    // Reset some states related to downstream actions
    setSteeredActivations(initialState.steeredActivations);
    setSteeredSeq(initialState.steeredSeq);

    const steeredSeq = await getSteeredSequence({
      sequence: submittedInputRef.current!, // Steering controls only appear after this ref is set
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
          input={proteinInput}
          setInput={setCustomSeqInput}
          onSubmit={handleSubmit}
          loading={playgroundState === PlaygroundState.LOADING_SAE_ACTIVATIONS}
          buttonText="Submit"
          onClear={() => {
            setCustomSeqInput("");
            setSearchParams({});
          }}
        />
      </div>

      {/* Once we have SAE activations, display sequence and structure */}
      {submittedInputRef.current && Object.keys(inputProteinActivations).length > 0 && (
        <>
          <Card className="my-4">
            <CardHeader>
              <CardTitle>SAE activations on input protein</CardTitle>
            </CardHeader>
            <CardContent>
              <FullSeqsViewer proteinActivationsData={inputProteinActivations} />
            </CardContent>
          </Card>
          {inputProteinActivations.chains.every((chain) =>
            chain.activations.every((activation) => activation === 0)
          ) && (
            <p className="text-sm mb-2">
              This feature did not activate on your sequence. Try a sequence more similar to the
              ones below.
            </p>
          )}

          {isPDBID(submittedInputRef.current) ? (
            <PDBStructureViewer
              viewerId="custom-viewer"
              proteinActivationsData={inputProteinActivations}
              onLoad={onStructureLoad}
            />
          ) : (
            <CustomStructureViewer
              viewerId="custom-viewer"
              proteinActivationsData={inputProteinActivations}
              onLoad={onStructureLoad}
            />
          )}
        </>
      )}

      {/* Once we have SAE activations and the first structure has loaded, render the steering controls */}
      {Object.keys(inputProteinActivations).length > 0 &&
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
                  <Card className="my-4">
                    <CardHeader>
                      <CardTitle>SAE activations on steered protein</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FullSeqsViewer
                        proteinActivationsData={{
                          chains: [
                            {
                              id: "Unknown",
                              sequence: steeredSeq as AminoAcidSequence,
                              activations: steeredActivations,
                            },
                          ],
                        }}
                      />
                    </CardContent>
                  </Card>

                  <CustomStructureViewer
                    viewerId="steered-viewer"
                    proteinActivationsData={{
                      chains: [
                        {
                          id: "Unknown",
                          sequence: steeredSeq as AminoAcidSequence,
                          activations: steeredActivations,
                        },
                      ],
                    }}
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
