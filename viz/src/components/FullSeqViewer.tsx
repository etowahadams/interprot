import React, { useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { redColorMapHex } from "@/utils.ts";
import { Copy, Check } from "lucide-react";

interface FullSeqViewerProps {
  sequence: string;
  activations: number[];
  showCopy?: boolean;
}

const FullSeqViewer: React.FC<FullSeqViewerProps> = ({ sequence, activations, showCopy }) => {
  const [copied, setCopied] = useState(false);
  const maxValue = useMemo(() => Math.max(...activations), [activations]);

  const copySequenceToClipboard = () => {
    navigator.clipboard.writeText(sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full">
      <div
        className="inline-flex flex-wrap"
        style={{ cursor: "pointer" }}
        onClick={copySequenceToClipboard}
      >
        {sequence.split("").map((char, index) => {
          const color = redColorMapHex(activations[index], maxValue);
          return (
            <TooltipProvider key={`token-${index}`} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger>
                  <span
                    style={{
                      backgroundColor: color,
                      borderRadius: 2,
                      letterSpacing: -1,
                    }}
                  >
                    {char}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Position: {index + 1}, SAE Activation: {activations[index].toFixed(3)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
        {showCopy && (
          <>
            {copied ? (
              <Check width={14} height={14} className="ml-1.5 mt-1.5" style={{ color: "green" }} />
            ) : (
              <Copy width={14} height={14} className="ml-1.5 mt-1.5" />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FullSeqViewer;
