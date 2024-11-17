import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { isProteinSequence, isPDBID, getPDBSequence, ProteinSequence, PDBID } from "@/utils";

export type ValidSeqInput = ProteinSequence | PDBID;

export default function SeqInput({
  input,
  setInput,
  onSubmit,
  loading,
  buttonText,
  exampleSeqs,
  onClear,
}: {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (input: ValidSeqInput) => void;
  loading: boolean;
  buttonText: string;
  exampleSeqs?: { [key: string]: ProteinSequence };
  onClear?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [input]);

  const handleSubmit = async () => {
    if (isProteinSequence(input)) {
      onSubmit(input);
    } else if (isPDBID(input)) {
      try {
        await getPDBSequence(input);
        onSubmit(input);
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred");
        }
      }
    } else {
      setError("Please enter either a valid protein sequence or a PDB ID");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-0.5">
      <Textarea
        placeholder="Enter protein sequence or PDB ID..."
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase().replace(/[\r\n]+/g, ""))}
        className={`w-full font-mono min-h-[100px] text-sm sm:text-sm md:text-sm lg:text-sm text-base ${
          error ? "border-red-500" : ""
        }`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !loading) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {exampleSeqs && (
        <div className="flex flex-row sm:gap-8 justify-between sm:justify-center">
          {Object.entries(exampleSeqs).map(([name, seq]) => (
            <Button variant="outline" key={name} onClick={() => onSubmit(seq)}>
              {name}
            </Button>
          ))}
        </div>
      )}
      <div className={`flex ${onClear ? "flex-col sm:flex-row sm:justify-end gap-2" : ""}`}>
        <Button
          onClick={handleSubmit}
          className={`${onClear ? "w-full sm:w-32" : "w-full"}`}
          disabled={loading || !input || !!error}
        >
          {loading ? "Loading..." : buttonText}
        </Button>
        {onClear && (
          <Button
            variant="outline"
            onClick={onClear}
            className="w-full sm:w-32"
            disabled={loading || !input}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
