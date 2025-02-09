import { useState, useEffect, useCallback, useContext } from "react";
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
import useUrlState from "@/hooks/useUrlState";
import FullSeqsViewer from "./FullSeqsViewer";
import PDBStructureViewer from "./PDBStructureViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SAEContext } from "@/SAEContext";

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

const CustomSeqPlayground = () => {
  const [inputProteinActivations, setInputProteinActivations] = useState<ProteinActivationsData>(
    initialState.inputProteinActivations
  );
  const [proteinInput, setCustomSeqInput] = useState<string>(initialState.proteinInput);

  const [playgroundState, setViewerState] = useState<PlaygroundState>(initialState.playgroundState);
  const [steeredSeq, setSteeredSeq] = useState<string>(initialState.steeredSeq);
  const [steerMultiplier, setSteerMultiplier] = useState<number>(initialState.steerMultiplier);
  const [steeredActivations, setSteeredActivations] = useState<number[]>(
    initialState.steeredActivations
  );
  const { feature, model } = useContext(SAEContext);

  const [urlState, setUrlState] = useUrlState<{ pdb?: string; seq?: string }>();

  const handleSubmit = useCallback(
    async (submittedInput: ValidSeqInput, feature: number, model: string) => {
      setViewerState(PlaygroundState.LOADING_SAE_ACTIVATIONS);

      setInputProteinActivations(initialState.inputProteinActivations);
      setSteeredSeq(initialState.steeredSeq);
      setSteerMultiplier(initialState.steerMultiplier);
      setSteeredActivations(initialState.steeredActivations);

      if (isPDBID(submittedInput)) {
        setInputProteinActivations(
          await constructProteinActivationsDataFromPDBID(submittedInput, feature, model)
        );
      } else {
        setInputProteinActivations(
          await constructProteinActivationsDataFromSequence(submittedInput, feature, model)
        );
      }
    },
    []
  );

  // Reset some states when the user navigates to a new feature
  useEffect(() => {
    setInputProteinActivations(initialState.inputProteinActivations);
    setViewerState(initialState.playgroundState);
    setSteeredSeq(initialState.steeredSeq);
    setSteerMultiplier(initialState.steerMultiplier);
    setSteeredActivations(initialState.steeredActivations);
  }, [feature]);

  // If an input is set in the URL, submit it
  useEffect(() => {
    if (feature === undefined) return;
    if (urlState.pdb && isPDBID(urlState.pdb)) {
      setCustomSeqInput(urlState.pdb);
      handleSubmit(urlState.pdb, feature, model);
    } else if (urlState.seq && isProteinSequence(urlState.seq)) {
      setCustomSeqInput(urlState.seq);
      handleSubmit(urlState.seq, feature, model);
    }
  }, [urlState.pdb, urlState.seq, setCustomSeqInput, handleSubmit, feature, model]);

  const handleSteer = async (input: string, feature: number, model: string) => {
    setViewerState(PlaygroundState.LOADING_STEERED_SEQUENCE);

    // Reset some states related to downstream actions
    setSteeredActivations(initialState.steeredActivations);
    setSteeredSeq(initialState.steeredSeq);

    const steeredSeq = await getSteeredSequence({
      sequence: input,
      dim: feature,
      multiplier: steerMultiplier,
      sae_name: model,
    });
    setSteeredSeq(steeredSeq);
    setSteeredActivations(
      await getSAEDimActivations({ sequence: steeredSeq, dim: feature, sae_name: model })
    );
  };

  const onStructureLoad = useCallback(() => setViewerState(PlaygroundState.IDLE), []);

  if (feature === undefined) return null;
  return (
    <div className="mb-6">
      <div className="mt-5">
        <SeqInput
          input={proteinInput}
          setInput={setCustomSeqInput}
          onSubmit={(input) => {
            if (isPDBID(input)) {
              setUrlState({ pdb: input, seq: undefined });
            } else {
              setUrlState({ pdb: undefined, seq: input });
            }
          }}
          loading={playgroundState === PlaygroundState.LOADING_SAE_ACTIVATIONS}
          buttonText="Submit"
          onClear={() => {
            setCustomSeqInput("");
            setInputProteinActivations(initialState.inputProteinActivations);
            setUrlState({ pdb: undefined, seq: undefined });
          }}
        />
      </div>

      {/* Once we have SAE activations, display sequence and structure */}
      {Object.keys(inputProteinActivations).length > 0 && (
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

          {urlState.pdb && (
            <PDBStructureViewer
              viewerId="custom-viewer"
              proteinActivationsData={inputProteinActivations}
              onLoad={onStructureLoad}
            />
          )}
          {urlState.seq && (
            <CustomStructureViewer
              viewerId="custom-viewer"
              proteinActivationsData={inputProteinActivations}
              onLoad={onStructureLoad}
            />
          )}
        </>
      )}

      {/* Once we have SAE activations, render the steering controls. Currently not supporting PDB ID inputs
          because they may have multiple chains. */}
      {isProteinSequence(proteinInput) &&
        Object.keys(inputProteinActivations).length > 0 &&
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
                  onClick={() => handleSteer(proteinInput, feature, model)}
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
