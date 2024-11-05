import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-2 p-1">
      <Textarea
        placeholder="Enter protein sequence..."
        value={sequence}
        onChange={(e) => setSequence(e.target.value)}
        className={`w-full font-mono min-h-[100px]`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !loading) {
            e.preventDefault();
            onSubmit(sequence);
          }
        }}
      />
      <Button
        onClick={() => onSubmit(sequence)}
        className="w-full sm:w-auto"
        disabled={loading || !sequence}
      >
        {loading ? "Loading..." : buttonText}
      </Button>
    </div>
  );
}
