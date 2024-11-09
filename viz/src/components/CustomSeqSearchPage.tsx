import { useState, useEffect, useCallback, useRef } from "react";
import SAEFeatureCard from "./SAEFeatureCard";
import { useSearchParams } from "react-router-dom";
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
import SeqInput from "./SeqInput";
import { EXAMPLE_SEQS_FOR_SEARCH } from "./ui/ExampleSeqsForSearch";
import { Input } from "@/components/ui/input";
import { isPDBID, getPDBSequence } from "@/utils";

export default function CustomSeqSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sequence, setSequence] = useState(searchParams.get("seq") || "");
  const [searchResults, setSearchResults] = useState<Array<{ dim: number; sae_acts: number[] }>>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const submittedSequence = useRef(searchParams.get("seq") || "");
  const pdbId = useRef<string | undefined>(undefined);
  const hasSubmittedSequence = submittedSequence.current !== "";

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("max");
  const resultsPerPage = 10;

  const [startPos, setStartPos] = useState<number | undefined>();
  const [endPos, setEndPos] = useState<number | undefined>();

  const filteredResults = searchResults.filter((result) => {
    if (!startPos && !endPos) return true;

    const hasActivationInRange = result.sae_acts.some((act, index) => {
      const pos = index + 1;
      const afterStart = !startPos || pos >= startPos;
      const beforeEnd = !endPos || pos <= endPos;
      return act > 0 && afterStart && beforeEnd;
    });

    return hasActivationInRange;
  });

  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const currentResults = filteredResults.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );
  const startIndex = (currentPage - 1) * resultsPerPage + 1;
  const endIndex = Math.min(currentPage * resultsPerPage, filteredResults.length);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSearch = useCallback(
    async (sequence: string) => {
      setIsLoading(true);
      setSearchParams({ seq: sequence });

      if (isPDBID(sequence)) {
        pdbId.current = sequence;
        sequence = await getPDBSequence(sequence);
      }
      submittedSequence.current = sequence;
      setSearchResults(await getSAEAllDimsActivations({ sequence }));
      setIsLoading(false);

      setStartPos(undefined);
      setEndPos(undefined);
    },
    [setSearchParams]
  );

  useEffect(() => {
    const urlSequence = searchParams.get("seq");
    if (urlSequence) {
      setSequence(urlSequence);
      submittedSequence.current = urlSequence;
      handleSearch(urlSequence);
    } else {
      setSearchResults([]);
      setSequence("");
      submittedSequence.current = "";
    }
  }, [searchParams, handleSearch]);

  return (
    <main
      className={`min-h-screen w-full overflow-x-hidden ${
        hasSubmittedSequence ? "" : "flex items-center justify-center"
      }`}
    >
      <div className={`${hasSubmittedSequence ? "w-full px-4" : "w-full max-w-2xl"} mt-16 sm:mt-0`}>
        <h1
          className={`text-4xl text-left sm:text-center ${hasSubmittedSequence ? "mb-6" : "mb-8"}`}
        >
          Search SAE features by sequence
        </h1>
        <div className={`${hasSubmittedSequence ? "w-full" : ""} flex flex-col gap-4`}>
          <SeqInput
            sequence={sequence}
            setSequence={setSequence}
            onSubmit={handleSearch}
            loading={isLoading}
            buttonText="Search"
            exampleSeqs={!hasSubmittedSequence ? EXAMPLE_SEQS_FOR_SEARCH : undefined}
          />
        </div>

        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2 mt-8 text-left">
            <div className="sm:flex sm:flex-row sm:justify-between sm:items-center px-2">
              <div className="flex flex-col sm:flex-row gap-4 w-full items-start sm:items-center">
                <div className="order-2 sm:order-1 text-sm">
                  {startIndex} - {endIndex} of {filteredResults.length} activating features
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2 sm:ml-auto">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                    <label className="font-medium text-sm whitespace-nowrap">Filter by pos.</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20"
                        placeholder="start"
                        min={1}
                        max={sequence.length}
                        value={startPos || ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          setStartPos(val);
                          setCurrentPage(1);
                        }}
                      />
                      <span className="text-sm"> - </span>
                      <Input
                        type="number"
                        className="w-20"
                        placeholder="end"
                        min={1}
                        max={sequence.length}
                        value={endPos || ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          setEndPos(val);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                    <label className="font-medium text-sm whitespace-nowrap">Sort by</label>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => {
                        setSortBy(value);
                        setCurrentPage(1);
                        setSearchResults((prevResults) => {
                          const sortedResults = [...prevResults];
                          switch (value) {
                            case "max":
                              sortedResults.sort(
                                (a, b) => Math.max(...b.sae_acts) - Math.max(...a.sae_acts)
                              );
                              break;
                            case "mean":
                              sortedResults.sort((a, b) => {
                                const meanA =
                                  a.sae_acts.reduce((sum, val) => sum + val, 0) / a.sae_acts.length;
                                const meanB =
                                  b.sae_acts.reduce((sum, val) => sum + val, 0) / b.sae_acts.length;
                                return meanB - meanA;
                              });
                              break;
                            case "mean_activated":
                              sortedResults.sort((a, b) => {
                                const activatedA = a.sae_acts.filter((val) => val > 0);
                                const activatedB = b.sae_acts.filter((val) => val > 0);
                                const meanA = activatedA.length
                                  ? activatedA.reduce((sum, val) => sum + val, 0) /
                                    activatedA.length
                                  : 0;
                                const meanB = activatedB.length
                                  ? activatedB.reduce((sum, val) => sum + val, 0) /
                                    activatedB.length
                                  : 0;
                                return meanB - meanA;
                              });
                              break;
                          }
                          return sortedResults;
                        });
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Sort by..." />
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
            </div>
            {filteredResults.length > 0 ? (
              <div className="flex flex-col gap-4">
                {currentResults.map((result) => (
                  <SAEFeatureCard
                    key={result.dim}
                    dim={result.dim}
                    sequence={submittedSequence.current}
                    pdbId={pdbId.current}
                    sae_acts={result.sae_acts}
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
          </div>
        )}
      </div>
    </main>
  );
}
