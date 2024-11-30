import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * A custom hook for managing URL search parameters related to protein sequences and PDB IDs.
 *
 * @returns {Object} An object containing:
 *   - value: The current value of either the 'pdb' or 'seq' parameter
 *   - setValue: Function to set either 'pdb' or 'seq' parameter
 *   - clear: Function to clear all search parameters
 */
export function useUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Gets the current value of either the 'pdb' or 'seq' parameter
   * @returns {string} The value of 'pdb' or 'seq' parameter, or empty string if neither exists
   */
  const getValue = useCallback(() => {
    return searchParams.get("pdb") || searchParams.get("seq") || "";
  }, [searchParams]);

  /**
   * Sets either the 'pdb' or 'seq' parameter, removing the other
   * @param {('seq'|'pdb')} key - Which parameter to set
   * @param {string|null} newValue - Value to set the parameter to
   */
  const setValue = useCallback(
    (key: "seq" | "pdb", newValue: string | null) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("seq");
      newParams.delete("pdb");
      if (newValue) {
        newParams.set(key, newValue);
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  /**
   * Removes all search parameters from the URL
   */
  const clear = useCallback(() => {
    const newParams = new URLSearchParams();
    setSearchParams(newParams);
  }, [setSearchParams]);

  return {
    urlInput: getValue(),
    setUrlInput: setValue,
    clearUrlInput: clear,
  } as const;
}
