import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef } from "react";

const NUMBER_KEYS = ["start", "end", "minPctAct", "maxPctAct"];
function useUrlState<S>(
  initialState?: S | (() => S)
): readonly [
  Partial<S>,
  (stateOrUpdater: Partial<S> | ((prev: Partial<S>) => Partial<S>)) => void
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStateRef = useRef(
    typeof initialState === "function" ? (initialState as () => S)() : initialState
  );

  // Parse current search params into object
  const parseSearchParams = useCallback(() => {
    const result: Partial<S> = {};
    for (const [key, value] of searchParams.entries()) {
      result[key as keyof S] = NUMBER_KEYS.includes(key)
        ? (Number(value) as S[keyof S])
        : (value as S[keyof S]);
    }
    return result;
  }, [searchParams]);

  // Update URL search params
  const setState = useCallback(
    (stateOrUpdater: Partial<S> | ((prev: Partial<S>) => Partial<S>)) => {
      const currentState = parseSearchParams();
      const updatedParams =
        typeof stateOrUpdater === "function" ? stateOrUpdater(currentState) : stateOrUpdater;

      const newSearchParams = new URLSearchParams(searchParams);

      // Update only the specified parameters
      Object.entries(updatedParams).forEach(([key, value]) => {
        if (value === undefined) {
          newSearchParams.delete(key);
        } else {
          newSearchParams.set(key, String(value));
        }
      });

      setSearchParams(newSearchParams);
    },
    [setSearchParams, parseSearchParams, searchParams]
  );

  // Initialize state on mount
  useEffect(() => {
    if (initialStateRef.current) {
      setState(initialStateRef.current);
    }
  }, [setState]);

  return [parseSearchParams(), setState] as const;
}

export default useUrlState;
