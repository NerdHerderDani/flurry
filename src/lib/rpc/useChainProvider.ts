import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { createDemoProvider } from "@flurry/forensics";
import { createPumpFunProvider } from "./pumpfun";
import { createRobinhoodChainProvider } from "./robinhood";
import { PUBLIC_RPC } from "./publicRpc";
import type { ChainProvider } from "./provider";
import {
  chainAtom,
  demoModeAtom,
  feedStatusAtom,
  rpcThrottledAtom,
  rpcUrlAtom,
} from "../../state/atoms";
import type { Chain } from "../schemas";

/**
 * Scanner and Graduation each call this hook, but they must share one live feed
 * per (chain, rpcUrl) rather than opening a fresh WebSocket every time either
 * tab mounts — bouncing between tabs a handful of times previously reopened
 * the connection every switch, which is wasteful and, under real rate limits,
 * can tip the feed into (or stall it in) poll fallback. Cached at module
 * scope, torn down only when the (chain, url, demo) key actually changes.
 */
let cache: { key: string; provider: ChainProvider } | null = null;

function getSharedProvider(
  chain: Chain,
  rpcUrl: string,
  demoMode: boolean,
  onStatus: (s: "LIVE" | "RECONNECTING") => void,
  onThrottle: (t: boolean) => void,
): ChainProvider {
  // Zero-setup SLOW MODE: nothing pasted → the verified public endpoint, on a
  // conservative budget — where one exists (Solana has none that a browser can
  // reach; see publicRpc.ts). Demo is an explicit toggle, and the fallback for
  // chains without a public endpoint.
  const pub = PUBLIC_RPC[chain];
  const url = demoMode ? "" : rpcUrl || (pub?.url ?? "");
  const slow = !demoMode && !rpcUrl && pub != null;
  const key = `${chain}:${demoMode ? "demo" : url}`;
  if (cache && cache.key === key) return cache.provider;
  cache?.provider.dispose?.();
  let provider: ChainProvider;
  const slowOpts =
    slow && pub
      ? {
          rps: pub.rps,
          ...(pub.maxWsFailures !== undefined && { maxWsFailures: pub.maxWsFailures }),
        }
      : {};
  if (!url) {
    provider = createDemoProvider();
  } else if (chain === "robinhood") {
    provider = createRobinhoodChainProvider(url, { onStatus, onThrottle, ...slowOpts });
  } else {
    provider = createPumpFunProvider(url, { onStatus, onThrottle, ...slowOpts });
  }
  cache = { key, provider };
  return provider;
}

/** Public SLOW MODE with no RPC URL set, full speed once one is, demo on request — the provider seam. */
export function useChainProvider(): ChainProvider {
  const chain = useAtomValue(chainAtom);
  const rpcUrl = useAtomValue(rpcUrlAtom);
  const demoMode = useAtomValue(demoModeAtom);
  const setFeedStatus = useSetAtom(feedStatusAtom);
  const setThrottled = useSetAtom(rpcThrottledAtom);

  const provider = getSharedProvider(chain, rpcUrl.trim(), demoMode, setFeedStatus, setThrottled);

  const isDemo = demoMode || (!rpcUrl.trim() && PUBLIC_RPC[chain] == null);
  useEffect(() => {
    setFeedStatus(isDemo ? "DEMO" : "RECONNECTING");
    setThrottled(false);
  }, [provider, isDemo, setFeedStatus, setThrottled]);

  return provider;
}
