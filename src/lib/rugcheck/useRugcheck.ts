import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { rugcheckKeyAtom } from "../../state/atoms";
import { fetchCrossCheck, RugcheckError } from "./client";
import type { Chain } from "../schemas";

/**
 * Strict enrichment: disabled (and network-silent) unless the user set a
 * RugCheck key AND the row is Solana AND it's expanded. Results cache for the
 * whole session per mint — a cross-check is a snapshot, not a feed.
 */
export function useRugcheck(mint: string, chain: Chain, expanded: boolean) {
  const key = useAtomValue(rugcheckKeyAtom).trim();
  return useQuery({
    queryKey: ["rugcheck", mint],
    enabled: expanded && chain === "solana" && key.length > 0,
    staleTime: Infinity,
    // Never hammer their API on failure: no retries on quota/auth, one on the rest.
    retry: (failureCount, err) => {
      if (err instanceof RugcheckError && (err.kind === "quota" || err.kind === "auth"))
        return false;
      return failureCount < 1;
    },
    queryFn: () => fetchCrossCheck(mint, key),
  });
}
