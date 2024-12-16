import { useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import SAEFeatureCard from "./SAEFeatureCard";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSAEAllDimsActivations } from "@/runpod.ts";
import SeqInput, { ValidSeqInput } from "./SeqInput";
import { Input } from "@/components/ui/input";
import {
  isPDBID,
  isProteinSequence,
  AminoAcidSequence,
  getPDBChainsData,
  PDBChainsData,
} from "@/utils";
import useUrlState from "@/hooks/useUrlState";
import { SAEContext } from "@/SAEContext";
import { SAE_CONFIGS } from "@/SAEConfigs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

const RESULTS_PER_PAGE = 20;
const DEFAULT_MAX_PERCENT_ACTIVATION = 20;
const DEFAULT_SORT_BY = "max";

type UrlState = {
  pdb: string;
  seq: string;
  chain: string;
  start: number;
  end: number;
  minPctAct: number;
  maxPctAct: number;
  sortBy: string;
};

export default function CustomSeqSearchPage() {
  const { model } = useContext(SAEContext);

  const [urlState, setUrlState] = useUrlState<UrlState>();
  const [input, setInput] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ dim: number; sae_acts: number[] }>>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const hasSubmittedInput = urlState.pdb || urlState.seq;
  const submittedSeqRef = useRef<AminoAcidSequence | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const [startPos, setStartPos] = useState<number | undefined>();
  const [endPos, setEndPos] = useState<number | undefined>();
  const [minPctAct, setMinPctAct] = useState<number | undefined>();
  const [maxPctAct, setMaxPctAct] = useState<number | undefined>(DEFAULT_MAX_PERCENT_ACTIVATION);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [chains, setChains] = useState<PDBChainsData[]>([]);

  useEffect(() => {
    if (!searchResults.length) return;
    if (!urlState.maxPctAct) {
      setUrlState({ maxPctAct: DEFAULT_MAX_PERCENT_ACTIVATION });
      setMaxPctAct(DEFAULT_MAX_PERCENT_ACTIVATION);
    }
    if (!urlState.sortBy) {
      setUrlState({ sortBy: DEFAULT_SORT_BY });
    }
  }, [searchResults.length, urlState.maxPctAct, urlState.sortBy, setUrlState]);

  const applyFilters = () => {
    setUrlState({
      start: startPos,
      end: endPos,
      minPctAct: minPctAct,
      maxPctAct: maxPctAct,
    });
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setStartPos(undefined);
    setEndPos(undefined);
    setMinPctAct(undefined);
    setMaxPctAct(undefined);
    setUrlState({
      start: undefined,
      end: undefined,
      minPctAct: undefined,
      maxPctAct: undefined,
    });
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const filteredResults = useMemo(() => {
    return searchResults.filter((result) => {
      if (!urlState.start && !urlState.end && !urlState.minPctAct && !urlState.maxPctAct)
        return true;
      const hasActivationInRange = result.sae_acts.some((act, pos) => {
        const afterStart = !urlState.start || pos >= urlState.start;
        const beforeEnd = !urlState.end || pos <= urlState.end;
        return act > 0 && afterStart && beforeEnd;
      });

      if (urlState.minPctAct || urlState.maxPctAct) {
        const activatedCount = result.sae_acts.filter((act) => act > 0).length;
        const percentActivated = (activatedCount / result.sae_acts.length) * 100;
        const aboveMin = !urlState.minPctAct || percentActivated >= urlState.minPctAct;
        const belowMax = !urlState.maxPctAct || percentActivated <= urlState.maxPctAct;
        return hasActivationInRange && aboveMin && belowMax;
      }

      return hasActivationInRange;
    });
  }, [searchResults, urlState.start, urlState.end, urlState.minPctAct, urlState.maxPctAct]);

  const totalPages = Math.ceil(filteredResults.length / RESULTS_PER_PAGE);
  const currentResults = filteredResults.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE
  );
  const startIndex = (currentPage - 1) * RESULTS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * RESULTS_PER_PAGE, filteredResults.length);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSearch = useCallback(
    async (submittedInput: ValidSeqInput) => {
      setIsLoading(true);
      setInput(submittedInput);

      if (isPDBID(submittedInput)) {
        const pdbChainsData = await getPDBChainsData(submittedInput);
        setChains(pdbChainsData);
        setUrlState((prev) => ({
          chain: prev.chain || pdbChainsData[0].id,
        }));
        submittedSeqRef.current = pdbChainsData[0].sequence;
        setSearchResults(
          await getSAEAllDimsActivations({
            sequence: pdbChainsData[0].sequence,
            sae_name: model,
          })
        );
      } else {
        submittedSeqRef.current = submittedInput;
        setSearchResults(
          await getSAEAllDimsActivations({
            sequence: submittedInput,
            sae_name: model,
          })
        );
        setChains([]);
      }

      setIsLoading(false);
    },
    [model, setUrlState]
  );

  useEffect(() => {
    if (urlState.pdb && isPDBID(urlState.pdb)) {
      setInput(urlState.pdb);
      handleSearch(urlState.pdb);
    } else if (urlState.seq && isProteinSequence(urlState.seq)) {
      setInput(urlState.seq);
      handleSearch(urlState.seq);
    } else {
      setInput("");
      setSearchResults([]);
    }
    // handleSearch runs unnecessarily if I add it here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState.pdb, urlState.seq]);

  const sortResults = useCallback(
    (results: Array<{ dim: number; sae_acts: number[] }>) => {
      const sortedResults = [...results];
      const start = urlState.start ?? 0;
      const end = urlState.end ?? results[0]?.sae_acts.length ?? 0;

      switch (urlState.sortBy) {
        case "max":
          sortedResults.sort((a, b) => {
            const maxA = Math.max(...a.sae_acts.slice(start, end + 1));
            const maxB = Math.max(...b.sae_acts.slice(start, end + 1));
            return maxB - maxA;
          });
          break;
        case "mean":
          sortedResults.sort((a, b) => {
            const sliceA = a.sae_acts.slice(start, end + 1);
            const sliceB = b.sae_acts.slice(start, end + 1);
            const meanA = sliceA.reduce((sum, val) => sum + val, 0) / sliceA.length;
            const meanB = sliceB.reduce((sum, val) => sum + val, 0) / sliceB.length;
            return meanB - meanA;
          });
          break;
        case "mean_activated":
          sortedResults.sort((a, b) => {
            const sliceA = a.sae_acts.slice(start, end + 1);
            const sliceB = b.sae_acts.slice(start, end + 1);
            const activatedA = sliceA.filter((val) => val > 0);
            const activatedB = sliceB.filter((val) => val > 0);
            const meanA = activatedA.length
              ? activatedA.reduce((sum, val) => sum + val, 0) / activatedA.length
              : 0;
            const meanB = activatedB.length
              ? activatedB.reduce((sum, val) => sum + val, 0) / activatedB.length
              : 0;
            return meanB - meanA;
          });
          break;
      }
      return sortedResults;
    },
    [urlState.sortBy, urlState.start, urlState.end]
  );

  useEffect(() => {
    if (searchResults.length > 0) {
      setSearchResults((prevResults) => sortResults(prevResults));
    }
  }, [urlState.sortBy, urlState.start, urlState.end, sortResults, searchResults.length]);

  useEffect(() => {
    if (urlState.chain && chains.length > 0) {
      const chain = chains.find((c) => c.id === urlState.chain);
      if (chain) {
        setSearchResults([]);
        submittedSeqRef.current = chain.sequence;
        getSAEAllDimsActivations({
          sequence: chain.sequence,
          sae_name: model,
        }).then((results) => {
          setSearchResults(results);
        });
      }
    }
  }, [urlState.chain, chains, model]);

  return (
    <main
      className={`min-h-screen w-full overflow-x-hidden ${
        hasSubmittedInput ? "" : "flex items-center justify-center"
      }`}
    >
      <div className={`${hasSubmittedInput ? "w-full px-4" : "w-full max-w-2xl"} mt-16 sm:mt-0`}>
        <h1 className={`text-4xl text-left sm:text-center ${hasSubmittedInput ? "mb-6" : "mb-8"}`}>
          Search features of {model}
        </h1>
        <div className={`${hasSubmittedInput ? "w-full" : ""} flex flex-col gap-4`}>
          <SeqInput
            input={input}
            setInput={setInput}
            onSubmit={(seqInput) => {
              if (isPDBID(seqInput)) {
                setUrlState({ pdb: seqInput, seq: undefined });
              } else {
                setUrlState({ pdb: undefined, seq: seqInput });
              }
            }}
            loading={isLoading}
            buttonText="Search"
            exampleSeqs={!hasSubmittedInput ? SAE_CONFIGS[model].searchExamples : undefined}
          />
        </div>

        <div className="flex flex-col gap-2 mt-4 text-left">
          {!isLoading && urlState.pdb && (
            <div className="flex items-center gap-2 mb-4">
              <Select
                value={urlState.chain}
                onValueChange={(value) => setUrlState({ chain: value })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {chains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      Chain {chain.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {searchResults.length > 0 && (
            <>
              <div className="sm:flex sm:flex-row sm:justify-between sm:items-center px-2">
                <div className="flex flex-col sm:flex-row gap-4 w-full items-start sm:items-center">
                  <div className="order-2 sm:order-1 text-sm">
                    {startIndex} - {endIndex} of {filteredResults.length} activating features
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 order-1 sm:order-2 sm:ml-auto w-full sm:w-auto">
                    <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          Filters
                          {(urlState.start ||
                            urlState.end ||
                            urlState.minPctAct ||
                            urlState.maxPctAct) && (
                            <span className="ml-1 h-2 w-2 rounded-full bg-primary"></span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80">
                        <DropdownMenuLabel>Filter Results</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-4 space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              position range{" "}
                              <div className="font-normal text-muted-foreground mt-1">
                                (inclusive, will show up as bold in results)
                              </div>
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-24 text-sm"
                                placeholder="start"
                                min={0}
                                max={submittedSeqRef.current?.length}
                                value={startPos !== undefined ? startPos : ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setStartPos(val);
                                }}
                              />
                              <span className="text-sm">-</span>
                              <Input
                                type="number"
                                className="w-24 text-sm"
                                placeholder="end"
                                min={0}
                                max={submittedSeqRef.current?.length}
                                value={endPos !== undefined ? endPos : ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setEndPos(val);
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              % activated across sequence
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-24 text-sm"
                                placeholder="min %"
                                min={0}
                                max={100}
                                value={minPctAct || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setMinPctAct(val);
                                }}
                              />
                              <span className="text-sm">-</span>
                              <Input
                                type="number"
                                className="w-24 text-sm"
                                placeholder="max %"
                                min={0}
                                max={100}
                                value={maxPctAct || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setMaxPctAct(val);
                                }}
                              />
                            </div>
                          </div>

                          <div className="pt-2 flex justify-between">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={clearFilters}
                            >
                              Clear all filters
                            </Button>
                            <Button size="sm" onClick={applyFilters}>
                              Set Filters
                            </Button>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Select
                      value={urlState.sortBy}
                      onValueChange={(value) => {
                        setUrlState({ sortBy: value });
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[350px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Sort by:</span>
                          <SelectValue placeholder="Choose sorting method" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="max">max activation across</SelectItem>
                        <SelectItem value="mean">mean activation across</SelectItem>
                        <SelectItem value="mean_activated">
                          mean activation across activated residues
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {filteredResults.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {currentResults.map((result) => (
                    <SAEFeatureCard
                      key={result.dim}
                      dim={result.dim}
                      proteinActivationsData={{
                        chains: [
                          {
                            id: "Unknown",
                            sequence: submittedSeqRef.current!,
                            activations: result.sae_acts,
                          },
                        ],
                      }}
                      highlightStart={urlState.start}
                      highlightEnd={urlState.end}
                    />
                  ))}
                  <Pagination>
                    <PaginationContent>
                      {currentPage > 1 && (
                        <>
                          <PaginationItem>
                            <PaginationPrevious
                              className="cursor-pointer"
                              onClick={() => {
                                handlePageChange(currentPage - 1);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              isActive={currentPage > 1}
                            />
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        </>
                      )}
                      <PaginationItem>{currentPage}</PaginationItem>
                      {currentPage < totalPages && (
                        <>
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationNext
                              className="cursor-pointer"
                              onClick={() => {
                                handlePageChange(currentPage + 1);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              isActive={currentPage !== totalPages}
                            />
                          </PaginationItem>
                        </>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : (
                <div className="text-sm flex justify-center mt-2">No features found.</div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
