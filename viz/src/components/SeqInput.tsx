import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const isValidProteinSequence = (sequence: string): boolean => {
  const validAminoAcids = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
  return validAminoAcids.test(sequence.trim());
};

export default function SeqInput({
  sequence,
  setSequence,
  onSubmit,
  loading,
  buttonText,
}: {
  sequence: string;
  setSequence: (sequence: string) => void;
  onSubmit: (sequence: string) => void;
  loading: boolean;
  buttonText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        placeholder="Enter protein sequence..."
        value={sequence}
        onChange={(e) => setSequence(e.target.value.toUpperCase())}
        className={`w-full font-mono min-h-[100px] ${
          sequence && !isValidProteinSequence(sequence) ? "border-red-500" : ""
        }`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !loading) {
            e.preventDefault();
            if (isValidProteinSequence(sequence)) {
              onSubmit(sequence);
            }
          }
        }}
      />
      {sequence && !isValidProteinSequence(sequence) && (
        <p className="text-sm text-red-500">
          Please enter a valid protein sequence consisting of only standard amino acids
        </p>
      )}
      <Button
        onClick={() => onSubmit(sequence)}
        className="w-full sm:w-auto"
        disabled={loading || !sequence || !isValidProteinSequence(sequence)}
      >
        {loading ? "Loading..." : buttonText}
      </Button>
    </div>
  );
}
