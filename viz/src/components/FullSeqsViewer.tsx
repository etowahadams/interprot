import React, { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProteinActivationsData, redColorMapHex } from "@/utils.ts";
import { Separator } from "@/components/ui/separator";

interface FullSeqViewerProps {
  proteinActivationsData: ProteinActivationsData;
  highlightStart?: number;
  highlightEnd?: number;
}

const FullSeqsViewer: React.FC<FullSeqViewerProps> = ({
  proteinActivationsData,
  highlightStart,
  highlightEnd,
}) => {
  const maxValue = useMemo(
    () => Math.max(...proteinActivationsData.chains.map((chain) => Math.max(...chain.activations))),
    [proteinActivationsData]
  );

  // Group chains by sequence
  const groupedChains = useMemo(() => {
    const groups = new Map<
      string,
      { ids: string[]; chain: (typeof proteinActivationsData.chains)[0] }
    >();

    proteinActivationsData.chains.forEach((chain) => {
      const existing = groups.get(chain.sequence);
      if (existing) {
        existing.ids.push(chain.id);
      } else {
        groups.set(chain.sequence, { ids: [chain.id], chain });
      }
    });

    return Array.from(groups.values());
  }, [proteinActivationsData]);

  return (
    <div className="w-full">
      <div className="inline-flex flex-wrap">
        {groupedChains.map(({ ids, chain }, index) => (
          <React.Fragment key={ids.join(",")}>
            <div className="mr-4">
              {ids[0] !== "Unknown" && (
                <div className="font-medium mb-2">Chain {ids.join(", ")}</div>
              )}
              <div
                className="flex flex-wrap"
                style={{
                  whiteSpace: "pre",
                  fontFamily: "monospace",
                }}
              >
                {chain.sequence.split("").map((char, pos) => {
                  const color = redColorMapHex(chain.activations[pos], maxValue);
                  const isHighlighted =
                    highlightStart === undefined
                      ? pos <= (highlightEnd ?? -1)
                      : highlightEnd === undefined
                      ? pos >= highlightStart
                      : pos >= highlightStart && pos <= highlightEnd;
                  return (
                    <TooltipProvider key={`token-${pos}`} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger>
                          <span
                            style={{
                              cursor: "pointer",
                              backgroundColor: color,
                              display: "inline-block",
                              width: "10px",
                              textAlign: "center",
                              fontWeight: isHighlighted ? "bold" : "normal",
                            }}
                          >
                            {char}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Position: {pos}, SAE Activation: {chain.activations[pos]}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
            {index !== groupedChains.length - 1 && <Separator className="my-4 w-full" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default FullSeqsViewer;
