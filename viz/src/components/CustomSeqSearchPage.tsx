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
import SeqInput, { ValidSeqInput } from "./SeqInput";
import { EXAMPLE_SEQS_FOR_SEARCH } from "./ui/ExampleSeqsForSearch";
import { Input } from "@/components/ui/input";
import { isPDBID, isProteinSequence, AminoAcidSequence, getPDBChainsData } from "@/utils";

export default function CustomSeqSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ dim: number; sae_acts: number[] }>>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const submittedInputRef = useRef<ValidSeqInput | undefined>(undefined);
  const hasSubmittedInput = submittedInputRef.current !== undefined;
  const submittedSeqRef = useRef<AminoAcidSequence | undefined>(undefined);

  // Somewhat hacky way to enable URL <-> state syncing (there's probably a better way):
  // - If URL changes (e.g. user navigates to a new shared link), set this to "url"
  //   and set state to the URL
  // - If the state changes (e.g. user submits a new sequence), set this to "state"
  //   and set the URL
  // Keeping track of this source of update makes it easier in useEffect to distinguish
  // which case we're in and avoid circular updates.
  const lastInputUpdateSource = useRef<"url" | "state" | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("max");
  const resultsPerPage = 10;

  const [startPos, setStartPos] = useState<number | undefined>();
  const [endPos, setEndPos] = useState<number | undefined>();

  const [warning, setWarning] = useState<string | undefined>(undefined);

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
    async (submittedInput: ValidSeqInput) => {
      setIsLoading(true);
      lastInputUpdateSource.current = "state";
      submittedInputRef.current = submittedInput;
      setInput(submittedInput); // This is needed when user clicks one of the examples

      let seq: AminoAcidSequence;
      if (isPDBID(submittedInput)) {
        const pdbChainsData = await getPDBChainsData(submittedInput);
        if (pdbChainsData.length > 1) {
          setWarning("PDB entry contains multiple chains. Only the first chain is considered.");
        }
        seq = pdbChainsData[0].sequence;
        setSearchParams({ pdb: submittedInput });
      } else {
        seq = submittedInput;
        setSearchParams({ seq: submittedInput });
      }

      submittedSeqRef.current = seq;
      setSearchResults(await getSAEAllDimsActivations({ sequence: seq }));
      setIsLoading(false);

      setStartPos(undefined);
      setEndPos(undefined);
    },
    [setSearchParams]
  );

  useEffect(() => {
    const urlInput = searchParams.get("pdb") || searchParams.get("seq");

    // If the last update was from the URL (e.g. user navigated to a new link), submit the sequence
    // and update the state
    if (lastInputUpdateSource.current !== "state") {
      lastInputUpdateSource.current = "url";
      if (urlInput && (isPDBID(urlInput) || isProteinSequence(urlInput))) {
        setInput(urlInput);
        submittedInputRef.current = urlInput;
        handleSearch(urlInput);
      } else {
        setSearchResults([]);
        setInput("");
        submittedInputRef.current = undefined;
      }
    }
    lastInputUpdateSource.current = null;
  }, [searchParams, handleSearch]);

  return (
    <main
      className={`min-h-screen w-full overflow-x-hidden ${
        hasSubmittedInput ? "" : "flex items-center justify-center"
      }`}
    >
      <div className={`${hasSubmittedInput ? "w-full px-4" : "w-full max-w-2xl"} mt-16 sm:mt-0`}>
        <h1 className={`text-4xl text-left sm:text-center ${hasSubmittedInput ? "mb-6" : "mb-8"}`}>
          Search SAE features
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

        <div className="flex flex-col gap-2 mt-8 text-left">
          {warning && <div className="text-sm text-yellow-500">{warning}</div>}

          {searchResults.length > 0 && (
            <>
              <div className="sm:flex sm:flex-row sm:justify-between sm:items-center px-2">
                <div className="flex flex-col sm:flex-row gap-4 w-full items-start sm:items-center">
                  <div className="order-2 sm:order-1 text-sm">
                    {startIndex} - {endIndex} of {filteredResults.length} activating features
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2 sm:ml-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                      <label className="font-medium text-sm whitespace-nowrap">
                        Filter by pos.
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          className="w-20 text-sm placeholder:text-sm"
                          placeholder="start"
                          min={1}
                          max={submittedSeqRef.current?.length}
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
                          className="w-20 text-sm placeholder:text-sm"
                          placeholder="end"
                          min={1}
                          max={submittedSeqRef.current?.length}
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
                                    a.sae_acts.reduce((sum, val) => sum + val, 0) /
                                    a.sae_acts.length;
                                  const meanB =
                                    b.sae_acts.reduce((sum, val) => sum + val, 0) /
                                    b.sae_acts.length;
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
                      proteinActivationsData={{
                        chains: [
                          {
                            id: "Unknown",
                            sequence: submittedSeqRef.current!,
                            activations: result.sae_acts,
                          },
                        ],
                      }}
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
