import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { createDemoProvider } from "./demo";
import { createPumpFunProvider } from "./pumpfun";
import type { ChainProvider } from "./provider";
import { feedStatusAtom, rpcThrottledAtom, rpcUrlAtom } from "../../state/atoms";

/**
 * Scanner and Graduation each call this hook, but they must share one live feed
 * per rpcUrl rather than opening a fresh WebSocket every time either tab mounts —
 * bouncing between tabs a handful of times previously reopened the connection
 * every switch, which is wasteful and, under real rate limits, can tip the feed
 * into (or stall it in) poll fallback. Cached at module scope, torn down only
 * when rpcUrl actually changes.
 */
let cache: { rpcUrl: string; provider: ChainProvider } | null = null;

function getSharedProvider(
  rpcUrl: string,
  onStatus: (s: "LIVE" | "RECONNECTING") => void,
  onThrottle: (t: boolean) => void,
): ChainProvider {
  if (cache && cache.rpcUrl === rpcUrl) return cache.provider;
  cache?.provider.dispose?.();
  const provider = rpcUrl
    ? createPumpFunProvider(rpcUrl, { onStatus, onThrottle })
    : createDemoProvider();
  cache = { rpcUrl, provider };
  return provider;
}

/** Demo feed with no RPC URL set, real pump.fun reads once one is — the provider seam. */
export function useChainProvider(): ChainProvider {
  const rpcUrl = useAtomValue(rpcUrlAtom);
  const setFeedStatus = useSetAtom(feedStatusAtom);
  const setThrottled = useSetAtom(rpcThrottledAtom);

  const provider = getSharedProvider(rpcUrl, setFeedStatus, setThrottled);

  useEffect(() => {
    setFeedStatus(rpcUrl ? "RECONNECTING" : "DEMO");
    setThrottled(false);
  }, [provider, rpcUrl, setFeedStatus, setThrottled]);

  return provider;
}
