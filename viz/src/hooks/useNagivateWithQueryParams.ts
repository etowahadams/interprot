import { useLocation, useNavigate } from "react-router-dom";

export const useNavigateWithSeqContext = () => {
  const navigate = useNavigate();
  const { search } = useLocation();

  return (path: string) => {
    const searchParams = new URLSearchParams(search);
    const newSearchParams = new URLSearchParams();

    // Only preserve 'pdb' and 'seq' parameters
    if (searchParams.has("pdb")) {
      newSearchParams.set("pdb", searchParams.get("pdb")!);
    }
    if (searchParams.has("seq")) {
      newSearchParams.set("seq", searchParams.get("seq")!);
    }

    const newSearch = newSearchParams.toString();
    navigate(path + (newSearch ? `?${newSearch}` : ""));
  };
};
