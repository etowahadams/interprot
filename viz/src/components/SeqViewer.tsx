import React, { useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { redColorMapHex, tokenToResidue, tokensToSequence } from "@/utils.ts";
import { Copy, Check } from "lucide-react";

export interface SeqFormat {
  dimension: number;
  feature_name?: string;
  examples: SingleSeq[];
}

export interface SingleSeq {
  alphafold_id: string;
  tokens_acts_list: Array<number>;
  tokens_list: Array<number>;
}

interface SeqViewerProps {
  seq: Omit<SingleSeq, "alphafold_id"> & { alphafold_id?: string };
}

function getFirstNonZeroIndex(arr: Array<number>) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== 0) {
      return i;
    }
  }
  return 0;
}

/**
 * This component takes in a SingleSeq and renders the sequence with the corresponding colors
 */
const SeqViewer: React.FC<SeqViewerProps> = ({ seq }) => {
  const [copied, setCopied] = useState(false);
  const maxValue = useMemo(() => {
    return Math.max(...seq.tokens_acts_list);
  }, [seq.tokens_acts_list]);
  const firstNonZero = getFirstNonZeroIndex(seq.tokens_acts_list);

  const startIdx = Math.max(firstNonZero - 30, 0);

  const tokensToShow = seq.tokens_list.slice(startIdx);
  const activationsToShow = seq.tokens_acts_list.slice(startIdx);

  const copySequenceToClipboard = () => {
    navigator.clipboard.writeText(tokensToSequence(seq.tokens_list));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500); // Reset after 1.5 seconds
  };

  return (
    <div className="inline-flex" style={{ cursor: "pointer" }} onClick={copySequenceToClipboard}>
      {copied ? (
        <Check width={14} height={14} style={{ marginTop: 6, marginRight: 4, color: "green" }} />
      ) : (
        <Copy width={14} height={14} style={{ marginTop: 6, marginRight: 4 }} />
      )}

      {startIdx > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger>
              <span style={{ color: "gray" }}>+{startIdx}</span>
              ...
            </TooltipTrigger>
            <TooltipContent>
              The number of amino acids hidden in this sequence
              {seq.alphafold_id && <span> (AlphaFoldDB ID: {seq.alphafold_id})</span>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {tokensToShow.map((token, index) => {
        const color = redColorMapHex(activationsToShow[index], maxValue);
        const tokenChar = tokenToResidue(token);
        return (
          <TooltipProvider key={`token-${index}`} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger>
                <span
                  key={`${token}-${color}`}
                  style={{
                    backgroundColor: color,
                    borderRadius: 2,
                    letterSpacing: -1,
                  }}
                >
                  {tokenChar}
                </span>
              </TooltipTrigger>
              <TooltipContent onClick={copySequenceToClipboard} style={{ cursor: "pointer" }}>
                Copy
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};

export default SeqViewer;
