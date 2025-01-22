import { useEffect, useState, useRef, useCallback } from "react";
import { redColorMapHex } from "@/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Markdown from "./Markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PieChartIcon } from "lucide-react";

// NOTE(liam): This component is written by Cursor pretty much entirely.

// Substitution matrix for 3Di tokens
// https://static-content.springer.com/esm/art%3A10.1038%2Fs41587-023-01773-0/MediaObjects/41587_2023_1773_MOESM1_ESM.pdf
const structTokenSubstitutionMatrix = [
  [6, -3, 1, 2, 3, -2, -2, -7, -3, -3, -10, -5, -1, 1, -4, -7, -5, -6, 0, -2, 0],
  [-3, 6, -2, -8, -5, -4, -4, -12, -13, 1, -14, 0, 0, 1, -1, -1, 0, -8, 1, -7, -9, 0],
  [1, -2, 4, -3, 0, 1, 1, -3, -5, -4, -5, -2, 1, -1, -1, -1, -4, -2, -3, -2, -2, 0],
  [2, -8, -3, 9, -2, -7, -4, -12, -10, -7, -17, -8, -6, -3, -8, -10, -10, -13, -6, -3, 0],
  [3, -5, 0, -2, 7, -3, -3, -5, 1, -3, -9, -5, -2, 2, -5, -8, -3, -7, 4, -4, 0],
  [-2, -4, 1, -7, -3, 6, 3, 0, -7, -7, -1, -2, -4, 3, -3, -3, 4, -6, -4, -2, 0],
  [-2, -4, 1, -4, -3, 3, 6, -4, -7, -6, -6, -6, -3, -3, -9, 6, -12, -5, -8, 0, 0],
  [-7, -12, -3, -12, -5, 0, -4, 6, -8, -5, -11, 7, -7, -6, -6, -3, -9, 6, -12, -5, -8, 0],
  [-3, -13, -5, -10, 1, -7, -7, -5, 9, -11, -8, -12, -6, -5, -9, -14, -5, -15, 5, -8, 0],
  [-3, -1, -4, -7, -3, -7, -6, -11, -11, 6, -16, -3, -2, 2, -4, -4, -9, 0, -8, -9, 0],
  [-10, -14, -5, -17, -9, -1, -6, -7, -8, -16, 10, -9, -9, -10, -5, -10, 3, -16, -6, -9, 0],
  [-5, 0, -2, -8, -5, -2, 0, -7, -12, -3, -9, 7, 0, -2, 2, 3, -4, 0, -8, -5, 0],
  [-1, 0, 1, -6, -2, -2, -1, -6, -6, -2, -9, 0, 4, 0, 0, -2, -4, 0, -4, -5, 0],
  [1, 1, 1, -3, 2, -4, -3, -6, -5, 2, -10, -2, 0, 5, -2, -4, -5, -1, -2, -5, 0],
  [-4, -1, -1, -8, -5, 3, 1, -3, -9, -4, -5, 2, 0, -2, -6, 2, 0, -1, -6, -3, 0],
  [-7, 0, -4, -10, -8, -3, -3, -9, -14, -4, -10, 3, -2, -4, -2, 6, -6, 0, -11, -9, 0],
  [-5, -8, -2, -10, -3, 4, 1, 6, -5, -9, 3, -4, -4, -5, 0, -6, 8, -9, -5, -5, 0],
  [-6, 1, -3, -13, -7, -6, -5, -12, -15, 0, -16, 0, -1, -1, 0, -9, 3, -10, -11, 0, 0],
  [0, -7, -2, -6, 4, 4, -4, -5, -5, -8, -6, -8, -4, -2, -6, -11, -5, -10, 8, -6, 0],
  [-2, -9, -2, -3, -4, -2, -3, -8, -9, -9, -5, -5, -3, -9, -5, -11, -6, -9, 6, -9, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export interface SeqWithSAEActs {
  sequence: string;
  "3di_sequence"?: string;
  sae_acts: Array<number>;
  alphafold_id: string;
  uniprot_id: string;
  name: string;
}

interface SeqsViewerProps {
  seqs: SeqWithSAEActs[];
  title?: string;
}

export default function SeqsViewer({ seqs, title }: SeqsViewerProps) {
  const [alignmentMode, setAlignmentMode] = useState<"first_act" | "max_act" | "msa">("first_act");
  const [alignedSeqs, setAlignedSeqs] = useState<SeqWithSAEActs[]>(seqs);
  const [isAligning, setIsAligning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sequenceType, setSequenceType] = useState<"aa" | "3di">("aa");

  const getSourceSequence = useCallback(
    (seq: SeqWithSAEActs) => {
      return sequenceType === "3di" && seq["3di_sequence"] ? seq["3di_sequence"] : seq.sequence;
    },
    [sequenceType]
  );

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

          const paddedSeq =
            "-".repeat(leftPadding) + getSourceSequence(seq) + "-".repeat(rightPadding);
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

          const paddedSeq =
            "-".repeat(leftPadding) + getSourceSequence(seq) + "-".repeat(rightPadding);
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
        const sequencesToAlign = seqs.map(getSourceSequence);
        // When aligning 3Di sequences, use a custom substitution matrix and penalize gaps less.
        const msaOptions = {
          gapopen: sequenceType === "3di" ? -5 : -10,
          gapextend: sequenceType === "3di" ? -1 : -2,
          matrix: sequenceType === "3di" ? structTokenSubstitutionMatrix : undefined,
          type: "amino",
        };

        // @ts-expect-error biomsa is loaded through a script tag in index.html
        biomsa.align(sequencesToAlign, msaOptions).then((result) => {
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
  }, [seqs, alignmentMode, sequenceType, getSourceSequence]);

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

  // Add this new function to calculate amino acid distribution
  const getAminoAcidDistribution = useCallback(() => {
    const distribution: { [key: string]: number } = {};

    alignedSeqs.forEach((seq) => {
      const sequence = getSourceSequence(seq);
      sequence.split("").forEach((char, index) => {
        // Only count residues with nonzero activations and that aren't gaps
        if (char !== "-" && seq.sae_acts[index] && seq.sae_acts[index] > 0) {
          distribution[char] = (distribution[char] || 0) + 1;
        }
      });
    });

    // Calculate total for percentage
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    return Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .map(([aa, count]) => ({
        name: aa,
        value: count,
        percentage: ((count / total) * 100).toFixed(1),
        fill: `hsl(${Math.random() * 360}, 50%, 50%)`,
      }));
  }, [alignedSeqs, getSourceSequence]);

  // Add this new function to calculate total counts
  const getActivatedResidueStats = useCallback(() => {
    let activatedCount = 0;
    let totalCount = 0;

    alignedSeqs.forEach((seq) => {
      const sequence = getSourceSequence(seq);
      sequence.split("").forEach((char, index) => {
        if (char !== "-") {
          totalCount++;
          if (seq.sae_acts[index] && seq.sae_acts[index] > 0) {
            activatedCount++;
          }
        }
      });
    });

    return { activatedCount, totalCount };
  }, [alignedSeqs, getSourceSequence]);

  return (
    <>
      <div className="flex items-center gap-4 mt-2 justify-between flex-wrap">
        {title && <h2 className="text-2xl font-semibold">{title}</h2>}
        <div className="hidden sm:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Tabs
              value={sequenceType}
              onValueChange={(value) => setSequenceType(value as "aa" | "3di")}
              className="w-[120px]"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="aa">AA</TabsTrigger>
                <TabsTrigger value="3di" disabled={!seqs.some((seq) => seq["3di_sequence"])}>
                  3Di
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p className="text-sm">
                    <span className="font-semibold">AA:</span> Amino acid tokens
                    <br />
                    <span className="font-semibold">3Di:</span>{" "}
                    <Markdown>
                      Structural tokens describing geometric conformation from
                      [Foldseek](https://www.nature.com/articles/s41587-023-01773-0)
                    </Markdown>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
          <Popover>
            <PopoverTrigger asChild>
              <button className="hover:bg-muted p-2 rounded border flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[600px]">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-2 pt-2">
                  <CardTitle className="text-md">
                    Amino acid distribution among activated residues in displayed sequences
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-popover text-popover-foreground rounded-md border px-3 py-1.5">
                                  <p className="font-medium">{`${data.name}: ${data.value}`}</p>
                                  <p className="text-sm text-muted-foreground">{`${data.percentage}%`}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                          {(() => {
                            const { activatedCount, totalCount } = getActivatedResidueStats();
                            return [
                              <tspan
                                key="count"
                                x="50%"
                                y="50%"
                                className="fill-foreground text-2xl font-bold"
                              >
                                {`${activatedCount}/${totalCount}`}
                              </tspan>,
                              <tspan
                                key="label"
                                x="50%"
                                y="50%"
                                dy="24"
                                className="fill-muted-foreground"
                              >
                                activated residues
                              </tspan>,
                            ];
                          })()}
                        </text>
                        <Pie
                          data={getAminoAcidDistribution()}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={90}
                          outerRadius={140}
                          label={({ name, percent, index }) => {
                            if (index < 3) {
                              return `${name} (${(percent * 100).toFixed(1)}%)`;
                            }
                            return null;
                          }}
                          labelLine={false}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </PopoverContent>
          </Popover>
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
                            Position: {seq.sequence.slice(0, index).replace(/-/g, "").length}
                            <br />
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
