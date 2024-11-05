import { useState, useEffect, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { getSAEAllDimsActivations } from "@/runpod.ts";

export default function CustomSequenceSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sequence, setSequence] = useState(searchParams.get("seq") || "");
  const submittedSequence = useRef(searchParams.get("seq") || "");
  const [searchResults, setSearchResults] = useState<Array<{ dim: number; sae_acts: number[] }>>(
    []
  );
  const hasSearched = searchResults.length > 0;
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10; // Adjust this number as needed

  const totalPages = Math.ceil(searchResults.length / resultsPerPage);
  const currentResults = searchResults.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSearch = useCallback(
    async (sequence: string) => {
      setIsLoading(true);
      submittedSequence.current = sequence;
      setSearchParams({ seq: sequence });

      setSearchResults(await getSAEAllDimsActivations({ sequence }));
      setIsLoading(false);
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
        hasSearched ? "" : "flex items-center justify-center"
      }`}
    >
      <div className={`${hasSearched ? "w-full px-4" : "w-full max-w-xl"}`}>
        <h1 className={`text-4xl font text-center ${hasSearched ? "mb-4" : "mb-8"}`}>
          Search sequence against SAE features
        </h1>
        <div className={`${hasSearched ? "w-full mx-auto" : ""} flex flex-col gap-4`}>
          <Textarea
            placeholder="Enter protein sequence..."
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            className={`w-full font-mono ${hasSearched ? "min-h-[80px]" : "min-h-[120px]"}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSearch(sequence);
              }
            }}
          />
          <div className="flex justify-center">
            <Button className="w-full" onClick={() => handleSearch(sequence)} disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {hasSearched && currentResults.length > 0 && (
          <div className="text-left mt-6 w-full">
            <label className="text-sm text-gray-500">
              Found {searchResults.length} activating features, ranked in order of the max
              activation across the sequence.
            </label>
            <div className="flex flex-col gap-4 mt-2">
              {currentResults.map((result) => (
                <SAEFeatureCard
                  key={result.dim}
                  dim={result.dim}
                  sequence={submittedSequence.current}
                  sae_acts={result.sae_acts}
                />
              ))}
            </div>
            <Pagination className="mt-4">
              <PaginationContent>
                {currentPage > 1 && (
                  <>
                    <PaginationItem>
                      <PaginationPrevious
                        className="cursor-pointer"
                        onClick={() => handlePageChange(currentPage - 1)}
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
                        onClick={() => handlePageChange(currentPage + 1)}
                        isActive={currentPage !== totalPages}
                      />
                    </PaginationItem>
                  </>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </main>
  );
}
