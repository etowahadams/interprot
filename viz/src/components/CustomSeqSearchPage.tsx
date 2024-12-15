import { useContext, useState, useEffect, useCallback, useRef } from "react";
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
import { EXAMPLE_SEQS_FOR_SEARCH } from "./ui/ExampleSeqsForSearch";
import { Input } from "@/components/ui/input";
import { isPDBID, isProteinSequence, AminoAcidSequence, getPDBChainsData } from "@/utils";
import { useUrlState } from "@/hooks/useUrlState";
import { SAEContext } from "@/SAEContext";
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

export default function CustomSeqSearchPage() {
  const { model } = useContext(SAEContext);

  const { urlInput, setUrlInput } = useUrlState();
  const [input, setInput] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ dim: number; sae_acts: number[] }>>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const hasSubmittedInput = urlInput !== "";
  const submittedSeqRef = useRef<AminoAcidSequence | undefined>(undefined);

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("max");

  const [startPos, setStartPos] = useState<number | undefined>();
  const [endPos, setEndPos] = useState<number | undefined>();

  const [warning, setWarning] = useState<string | undefined>(undefined);

  const [minPercentActivation, setMinPercentActivation] = useState<number | undefined>();
  const [maxPercentActivation, setMaxPercentActivation] = useState<number | undefined>(
    DEFAULT_MAX_PERCENT_ACTIVATION
  );

  const [tempStartPos, setTempStartPos] = useState<number | undefined>();
  const [tempEndPos, setTempEndPos] = useState<number | undefined>();
  const [tempMinPercentActivation, setTempMinPercentActivation] = useState<number | undefined>();
  const [tempMaxPercentActivation, setTempMaxPercentActivation] = useState<number | undefined>(
    DEFAULT_MAX_PERCENT_ACTIVATION
  );

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    setTempStartPos(startPos);
    setTempEndPos(endPos);
    setTempMinPercentActivation(minPercentActivation);
    setTempMaxPercentActivation(maxPercentActivation);
    setWarning(undefined);
  }, [startPos, endPos, minPercentActivation, maxPercentActivation]);

  const applyFilters = () => {
    setStartPos(tempStartPos);
    setEndPos(tempEndPos);
    setMinPercentActivation(tempMinPercentActivation);
    setMaxPercentActivation(tempMaxPercentActivation);
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setTempStartPos(undefined);
    setTempEndPos(undefined);
    setTempMinPercentActivation(undefined);
    setTempMaxPercentActivation(DEFAULT_MAX_PERCENT_ACTIVATION);
    setStartPos(undefined);
    setEndPos(undefined);
    setMinPercentActivation(undefined);
    setMaxPercentActivation(DEFAULT_MAX_PERCENT_ACTIVATION);
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const filteredResults = searchResults.filter((result) => {
    if (!startPos && !endPos && !minPercentActivation && !maxPercentActivation) return true;
    const hasActivationInRange = result.sae_acts.some((act, pos) => {
      const afterStart = !startPos || pos >= startPos;
      const beforeEnd = !endPos || pos <= endPos;
      return act > 0 && afterStart && beforeEnd;
    });

    if (minPercentActivation || maxPercentActivation) {
      const activatedCount = result.sae_acts.filter((act) => act > 0).length;
      const percentActivated = (activatedCount / result.sae_acts.length) * 100;
      const aboveMin = !minPercentActivation || percentActivated >= minPercentActivation;
      const belowMax = !maxPercentActivation || percentActivated <= maxPercentActivation;
      return hasActivationInRange && aboveMin && belowMax;
    }

    return hasActivationInRange;
  });

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

      let warning = "";
      let seq: AminoAcidSequence;
      if (isPDBID(submittedInput)) {
        const pdbChainsData = await getPDBChainsData(submittedInput);
        if (pdbChainsData.length > 1) {
          warning = "PDB entry contains multiple chains. Only the first chain is considered.";
        }
        seq = pdbChainsData[0].sequence;
        setUrlInput("pdb", submittedInput);
      } else {
        seq = submittedInput;
        setUrlInput("seq", submittedInput);
      }

      submittedSeqRef.current = seq;
      setSearchResults(await getSAEAllDimsActivations({ sequence: seq, sae_name: model }));
      setIsLoading(false);

      setStartPos(undefined);
      setEndPos(undefined);
      setMinPercentActivation(undefined);
      setMaxPercentActivation(DEFAULT_MAX_PERCENT_ACTIVATION);
      setWarning(warning);
    },
    [model, setUrlInput]
  );

  useEffect(() => {
    if (urlInput && (isPDBID(urlInput) || isProteinSequence(urlInput))) {
      setInput(urlInput);
      handleSearch(urlInput);
    } else {
      setSearchResults([]);
      setInput("");
    }
  }, [urlInput, handleSearch]);

  const sortResults = useCallback(
    (results: Array<{ dim: number; sae_acts: number[] }>) => {
      const sortedResults = [...results];
      const start = startPos ?? 0;
      const end = endPos ?? results[0]?.sae_acts.length ?? 0;

      switch (sortBy) {
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
    [sortBy, startPos, endPos]
  );

  useEffect(() => {
    if (searchResults.length > 0) {
      setSearchResults((prevResults) => sortResults(prevResults));
    }
  }, [startPos, endPos, sortResults, searchResults.length]);

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
            onSubmit={handleSearch}
            loading={isLoading}
            buttonText="Search"
            exampleSeqs={!hasSubmittedInput ? EXAMPLE_SEQS_FOR_SEARCH : undefined}
          />
        </div>

        <div className="flex flex-col gap-2 mt-4 text-left">
          {warning && <div className="text-sm text-yellow-500">{warning}</div>}

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
                          {(startPos || endPos || minPercentActivation || maxPercentActivation) && (
                            <span className="ml-1 h-2 w-2 rounded-full bg-primary"></span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80">
                        <DropdownMenuLabel>Filter Features</DropdownMenuLabel>
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
                                value={tempStartPos !== undefined ? tempStartPos : ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setTempStartPos(val);
                                }}
                              />
                              <span className="text-sm">-</span>
                              <Input
                                type="number"
                                className="w-24 text-sm"
                                placeholder="end"
                                min={0}
                                max={submittedSeqRef.current?.length}
                                value={tempEndPos !== undefined ? tempEndPos : ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setTempEndPos(val);
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
                                value={tempMinPercentActivation || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setTempMinPercentActivation(val);
                                }}
                              />
                              <span className="text-sm">-</span>
                              <Input
                                type="number"
                                className="w-24 text-sm"
                                placeholder="max %"
                                min={0}
                                max={100}
                                value={tempMaxPercentActivation || ""}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                                  setTempMaxPercentActivation(val);
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
                      value={sortBy}
                      onValueChange={(value) => {
                        setSortBy(value);
                        setCurrentPage(1);
                        setSearchResults((prevResults) => sortResults(prevResults));
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
                      highlightStart={startPos}
                      highlightEnd={endPos}
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
