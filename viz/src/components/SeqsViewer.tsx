import { useEffect, useState, useRef, useCallback } from "react";
import { redColorMapHex } from "@/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// NOTE(liam): This component is written by Cursor pretty much entirely.

export interface SeqWithSAEActs {
  sequence: string;
  sae_acts: Array<number>;
  alphafold_id: string;
  uniprot_id: string;
  name: string;
}

interface SeqsViewerProps {
  seqs: SeqWithSAEActs[];
  title: string;
}

export default function SeqsViewer({ seqs, title }: SeqsViewerProps) {
  const [alignmentMode, setAlignmentMode] = useState<"first_act" | "max_act" | "msa">("first_act");
  const [alignedSeqs, setAlignedSeqs] = useState<SeqWithSAEActs[]>(seqs);
  const [isAligning, setIsAligning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (seqs.length === 0) return;
    setIsAligning(true);

    // Force a delay to allow React to render the loading state
    setTimeout(() => {
      if (alignmentMode === "first_act") {
        // First nonzero activation alignment
        const firstActIndex = seqs.reduce((maxIdx, seq) => {
          const firstNonzeroIdx = seq.sae_acts.findIndex((act) => act > 0);
          return Math.max(maxIdx, firstNonzeroIdx);
        }, 0);

        // Find the maximum sequence length after left padding
        const maxLength = seqs.reduce((maxLen, seq) => {
          const firstNonzeroIdx = seq.sae_acts.findIndex((act) => act > 0);
          const leftPadding = firstActIndex - firstNonzeroIdx;
          return Math.max(maxLen, leftPadding + seq.sequence.length);
        }, 0);

        const newAlignedSeqs = seqs.map((seq) => {
          const firstNonzeroIdx = seq.sae_acts.findIndex((act) => act > 0);
          const leftPadding = firstActIndex - firstNonzeroIdx;
          const rightPadding = maxLength - (leftPadding + seq.sequence.length);

          const paddedSeq = "-".repeat(leftPadding) + seq.sequence + "-".repeat(rightPadding);
          const paddedActs = Array(leftPadding)
            .fill(null)
            .concat(seq.sae_acts)
            .concat(Array(rightPadding).fill(null));

          return {
            ...seq,
            sequence: paddedSeq,
            sae_acts: paddedActs,
          };
        });

        setAlignedSeqs(newAlignedSeqs);
        // Delay scroll until after state update
        setTimeout(() => scrollToPosition(firstActIndex - 30), 0);
        setIsAligning(false);
      } else if (alignmentMode === "max_act") {
        // Max activation alignment
        const maxActIndex = seqs.reduce((maxIdx, seq) => {
          const maxLocalIdx = seq.sae_acts.indexOf(Math.max(...seq.sae_acts));
          return Math.max(maxIdx, maxLocalIdx);
        }, 0);

        // Find the maximum sequence length after left padding
        const maxLength = seqs.reduce((maxLen, seq) => {
          const maxLocalIdx = seq.sae_acts.indexOf(Math.max(...seq.sae_acts));
          const leftPadding = maxActIndex - maxLocalIdx;
          return Math.max(maxLen, leftPadding + seq.sequence.length);
        }, 0);

        const newAlignedSeqs = seqs.map((seq) => {
          const maxLocalIdx = seq.sae_acts.indexOf(Math.max(...seq.sae_acts));
          const leftPadding = maxActIndex - maxLocalIdx;
          const rightPadding = maxLength - (leftPadding + seq.sequence.length);

          const paddedSeq = "-".repeat(leftPadding) + seq.sequence + "-".repeat(rightPadding);
          const paddedActs = Array(leftPadding)
            .fill(null)
            .concat(seq.sae_acts)
            .concat(Array(rightPadding).fill(null));

          return {
            ...seq,
            sequence: paddedSeq,
            sae_acts: paddedActs,
          };
        });

        setAlignedSeqs(newAlignedSeqs);
        // Delay scroll until after state update
        setTimeout(() => scrollToPosition(maxActIndex - 30), 0);
        setIsAligning(false);
      } else if (alignmentMode === "msa") {
        // @ts-expect-error biomsa is loaded through a script tag in index.html
        biomsa.align(seqs.map((seq) => seq.sequence)).then((result) => {
          // Update sequences with aligned versions
          const newAlignedSeqs = seqs.map((seq, i) => {
            const alignedSeq = result[i];
            let actIndex = 0;
            // Create new sae_acts array that matches gaps with -1
            const alignedActs = Array(alignedSeq.length).fill(null);

            // Fill in actual activation values, skipping gaps
            for (let j = 0; j < alignedSeq.length; j++) {
              if (alignedSeq[j] !== "-") {
                alignedActs[j] = seq.sae_acts[actIndex];
                actIndex++;
              }
            }

            return {
              ...seq,
              sequence: alignedSeq,
              sae_acts: alignedActs,
            };
          });
          setAlignedSeqs(newAlignedSeqs);

          // Scroll to first high activation position
          const firstHighAct = newAlignedSeqs[0].sae_acts.findIndex((act) => act > 0.5);
          setTimeout(() => scrollToPosition(firstHighAct - 30), 0);
          setIsAligning(false);
        });
      }
    }, 0);
  }, [seqs, alignmentMode]);

  const scrollToPosition = (index: number) => {
    if (!containerRef.current) return;
    // Each character is 10px wide
    const scrollPosition = Math.max(0, index * 10);

    containerRef.current.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });
  };

  // Update maxValue calculation to ignore -1 values (gaps)
  const maxValue = Math.max(
    ...alignedSeqs.map((seq) => Math.max(...seq.sae_acts.filter((act) => act !== null)))
  );

  const copySequence = useCallback(async (sequence: string, id: string) => {
    const cleanSequence = sequence.replace(/-/g, "");
    await navigator.clipboard.writeText(cleanSequence);

    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1000);
  }, []);

  return (
    <>
      <div className="flex items-center gap-4 mt-8 justify-between flex-wrap">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <div className="hidden sm:flex items-center gap-4">
          <ToggleGroup
            type="single"
            value={alignmentMode}
            onValueChange={(value) => {
              if (value) setAlignmentMode(value as "msa" | "max_act" | "first_act");
            }}
          >
            <ToggleGroupItem value="first_act" aria-label="Align by first activation">
              <div>Align first activation</div>
            </ToggleGroupItem>
            <ToggleGroupItem value="max_act" aria-label="Align by maximum activation">
              <div>Align max activation</div>
            </ToggleGroupItem>
            <ToggleGroupItem value="msa" aria-label="Multiple sequence alignment">
              <div>MSA</div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div
        className="rounded-xl border bg-card text-card-foreground shadow mt-5 py-4 flex flex-row"
        style={{
          whiteSpace: "pre",
          fontFamily: "monospace",
        }}
      >
        {isAligning ? (
          <div className="flex flex-col gap-2.5 overflow-hidden px-5 py-1">
            {Array(alignedSeqs.length)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-[2000px]" />
              ))}
          </div>
        ) : (
          <>
            <div>
              {alignedSeqs.map((seq) => (
                <div key={seq.alphafold_id} className="sticky left-0 z-10 bg-card pl-3 pr-2">
                  <button
                    onClick={() => copySequence(seq.sequence, seq.alphafold_id || "")}
                    className="flex-none hover:bg-muted rounded"
                    aria-label="Copy sequence"
                  >
                    {copiedId === seq.alphafold_id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-x-auto" ref={containerRef}>
              {alignedSeqs.map((seq) => (
                <div key={seq.alphafold_id}>
                  {seq.sequence.split("").map((char, index) => {
                    // Only color if not a gap and has valid activation
                    const color =
                      char === "-" || seq.sae_acts[index] === null
                        ? "transparent"
                        : redColorMapHex(seq.sae_acts[index], maxValue);
                    return seq.sae_acts[index] === null ? (
                      <span
                        key={`${seq.alphafold_id}-${index}`}
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
                    ) : (
                      <TooltipProvider key={`${seq.alphafold_id}-${index}`} delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger>
                            <span
                              key={`${seq.alphafold_id}-${index}`}
                              style={{
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
                            SAE Activation: {seq.sae_acts[index]?.toFixed(3)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
