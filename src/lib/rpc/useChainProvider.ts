import { useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { createDemoProvider } from "./demo";
import { createPumpFunProvider } from "./pumpfun";
import type { ChainProvider } from "./provider";
import { feedStatusAtom, rpcThrottledAtom, rpcUrlAtom } from "../../state/atoms";

/** Demo feed with no RPC URL set, real pump.fun reads once one is — the provider seam. */
export function useChainProvider(): ChainProvider {
  const rpcUrl = useAtomValue(rpcUrlAtom);
  const setFeedStatus = useSetAtom(feedStatusAtom);
  const setThrottled = useSetAtom(rpcThrottledAtom);

  const provider = useMemo(
    () =>
      rpcUrl
        ? createPumpFunProvider(rpcUrl, { onStatus: setFeedStatus, onThrottle: setThrottled })
        : createDemoProvider(),
    [rpcUrl, setFeedStatus, setThrottled],
  );

  useEffect(() => {
    setFeedStatus(rpcUrl ? "RECONNECTING" : "DEMO");
    setThrottled(false);
    return () => provider.dispose?.();
  }, [provider, rpcUrl, setFeedStatus, setThrottled]);

  return provider;
}
