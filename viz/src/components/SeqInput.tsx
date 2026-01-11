import { useState, useEffect, ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { isProteinSequence, isPDBID, AminoAcidSequence, PDBID, getPDBChainsData } from "@/utils";
import { ArrowUp, Loader2, X } from "lucide-react";

export type ValidSeqInput = AminoAcidSequence | PDBID;

export default function SeqInput({
  input,
  setInput,
  onSubmit,
  loading,
  exampleSeqs,
  onClear,
  bottomLeftSlot,
  submittedInput,
}: {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (input: ValidSeqInput) => void;
  loading: boolean;
  exampleSeqs?: { [key: string]: AminoAcidSequence | PDBID };
  onClear?: () => void;
  bottomLeftSlot?: ReactNode;
  submittedInput?: string;
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
        await getPDBChainsData(input);
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
      <div className="relative">
        <Textarea
          placeholder="Enter protein sequence or PDB ID..."
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().replace(/[\r\n]+/g, ""))}
          className={`w-full font-mono min-h-[100px] text-sm pr-14 pb-12 ${
            error ? "border-red-500" : ""
          }`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !loading) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {bottomLeftSlot}
          {onClear && input && (
            <Button
              onClick={onClear}
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <Button
          onClick={handleSubmit}
          size="icon"
          className="absolute bottom-3 right-3 h-8 w-8 rounded-lg"
          disabled={loading || !input || !!error || input === submittedInput}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {exampleSeqs && (
        <div className="flex flex-row flex-wrap sm:gap-x-8 gap-x-2 gap-y-2 justify-between sm:justify-center">
          {Object.entries(exampleSeqs).map(([name, seq]) => (
            <Button variant="outline" key={name} onClick={() => onSubmit(seq)}>
              {name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
