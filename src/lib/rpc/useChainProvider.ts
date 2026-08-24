import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { createDemoProvider } from "./demo";
import { createPumpFunProvider } from "./pumpfun";
import { createRobinhoodChainProvider } from "./robinhood";
import type { ChainProvider } from "./provider";
import { chainAtom, feedStatusAtom, rpcThrottledAtom, rpcUrlAtom } from "../../state/atoms";
import type { Chain } from "../schemas";

/**
 * Scanner and Graduation each call this hook, but they must share one live feed
 * per (chain, rpcUrl) rather than opening a fresh WebSocket every time either
 * tab mounts — bouncing between tabs a handful of times previously reopened
 * the connection every switch, which is wasteful and, under real rate limits,
 * can tip the feed into (or stall it in) poll fallback. Cached at module
 * scope, torn down only when the (chain, rpcUrl) key actually changes.
 */
let cache: { key: string; provider: ChainProvider } | null = null;

function getSharedProvider(
  chain: Chain,
  rpcUrl: string,
  onStatus: (s: "LIVE" | "RECONNECTING") => void,
  onThrottle: (t: boolean) => void,
): ChainProvider {
  const key = `${chain}:${rpcUrl}`;
  if (cache && cache.key === key) return cache.provider;
  cache?.provider.dispose?.();
  let provider: ChainProvider;
  if (!rpcUrl) {
    provider = createDemoProvider();
  } else if (chain === "robinhood") {
    provider = createRobinhoodChainProvider(rpcUrl, { onStatus, onThrottle });
  } else {
    provider = createPumpFunProvider(rpcUrl, { onStatus, onThrottle });
  }
  cache = { key, provider };
  return provider;
}

/** Demo feed with no RPC URL set, real chain reads once one is — the provider seam. */
export function useChainProvider(): ChainProvider {
  const chain = useAtomValue(chainAtom);
  const rpcUrl = useAtomValue(rpcUrlAtom);
  const setFeedStatus = useSetAtom(feedStatusAtom);
  const setThrottled = useSetAtom(rpcThrottledAtom);

  const provider = getSharedProvider(chain, rpcUrl, setFeedStatus, setThrottled);

  useEffect(() => {
    setFeedStatus(rpcUrl ? "RECONNECTING" : "DEMO");
    setThrottled(false);
  }, [provider, rpcUrl, setFeedStatus, setThrottled]);

  return provider;
}
