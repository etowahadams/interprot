import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { isProteinSequence, isPDBID, getPDBSequence } from "@/utils";

// TODO(liam): We should come up with a better way to handle the input
// that can either be a sequence or a PDB ID, maybe with some union type.
// Currently both are stored as strings and some differential logic in
// display components queue off of `isPDBID` checks.

export default function SeqInput({
  sequence,
  setSequence,
  onSubmit,
  loading,
  buttonText,
  exampleSeqs,
}: {
  sequence: string;
  setSequence: (sequence: string) => void;
  onSubmit: (sequence: string) => void;
  loading: boolean;
  buttonText: string;
  exampleSeqs?: { [key: string]: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const isValidInput = (input: string): boolean => {
    return isProteinSequence(input) || isPDBID(input);
  };

  const handleSubmit = async () => {
    // If PBD ID, validate by fetching sequence
    if (isPDBID(sequence)) {
      try {
        await getPDBSequence(sequence);
      } catch (e) {
        console.error(e);
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred");
        }
        return;
      }
    }
    onSubmit(sequence);
  };

  return (
    <div className="flex flex-col gap-4 p-0.5">
      <Textarea
        placeholder="Enter protein sequence or PDB ID..."
        value={sequence}
        onChange={(e) => setSequence(e.target.value.toUpperCase())}
        className={`w-full font-mono min-h-[100px] text-sm sm:text-sm md:text-sm lg:text-sm text-base ${
          sequence && !isValidInput(sequence) ? "border-red-500" : ""
        }`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !loading) {
            e.preventDefault();
            if (isValidInput(sequence)) {
              onSubmit(sequence);
            }
          }
        }}
      />
      {sequence && !isValidInput(sequence) && (
        <p className="text-sm text-red-500">
          Please enter either a valid protein sequence or a PDB ID
        </p>
      )}
      {exampleSeqs && (
        <div className="flex flex-row sm:gap-8 justify-between sm:justify-center">
          {Object.entries(exampleSeqs).map(([name, seq]) => (
            <Button variant="outline" key={name} onClick={() => onSubmit(seq)}>
              {name}
            </Button>
          ))}
        </div>
      )}
      <Button
        onClick={handleSubmit}
        className="w-full sm:w-auto"
        disabled={loading || !sequence || !isValidInput(sequence)}
      >
        {loading ? "Loading..." : buttonText}
      </Button>
      {error && <p className="text-left text-sm text-red-500">{error}</p>}
    </div>
  );
}
