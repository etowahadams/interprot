import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomSeqInputProps {
  sequence: string;
  setSequence: (sequence: string) => void;
  handleSubmit: () => void;
}

const CustomSeqInput = ({ sequence, setSequence, handleSubmit }: CustomSeqInputProps) => {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="flex overflow-x-auto">
      <Input
        type="text"
        style={{ marginRight: 10 }}
        value={sequence}
        onChange={(e) => setSequence(e.target.value)}
        placeholder="Enter your own protein sequence"
      />
      <Button onClick={handleSubmit} disabled={isLoading || !sequence}>
        {isLoading ? "Loading..." : "Submit"}
      </Button>
    </div>
  );
};

export default CustomSeqInput;
