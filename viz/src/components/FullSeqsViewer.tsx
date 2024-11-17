import React, { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProteinActivationsData, redColorMapHex } from "@/utils.ts";
import { Separator } from "@/components/ui/separator";

interface FullSeqViewerProps {
  proteinActivationsData: ProteinActivationsData;
}

const FullSeqsViewer: React.FC<FullSeqViewerProps> = ({ proteinActivationsData }) => {
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
              {ids[0] !== "Unknown" && <div className="font-bold mb-1">Chain {ids.join(", ")}</div>}
              <div
                className="flex flex-wrap"
                style={{
                  whiteSpace: "pre",
                  fontFamily: "monospace",
                }}
              >
                {chain.sequence.split("").map((char, index) => {
                  const color = redColorMapHex(chain.activations[index], maxValue);
                  return (
                    <TooltipProvider key={`token-${index}`} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger>
                          <span
                            style={{
                              cursor: "pointer",
                              backgroundColor: color,
                              display: "inline-block",
                              width: "10px",
                              textAlign: "center",
                            }}
                          >
                            {char}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Position: {index}, SAE Activation: {chain.activations[index].toFixed(3)}
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
