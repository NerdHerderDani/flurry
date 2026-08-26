import { Chain, isValidAddress } from "./schemas";

/**
 * Deep-link params: ?chain=<solana|robinhood>&mint=<address>. Params never
 * carry keys or config; mint is validated with the per-chain validator before
 * any use, and garbage fails to a visible error, never a blank screen.
 */
export type DeepLink =
  | { kind: "none" }
  | { kind: "token"; chain: Chain; mint: string }
  | { kind: "error"; message: string };

export function parseDeepLink(search: string): DeepLink {
  const params = new URLSearchParams(search);
  const chainRaw = params.get("chain");
  const mint = params.get("mint");
  if (chainRaw === null && mint === null) return { kind: "none" };
  if (!chainRaw || !mint) {
    return { kind: "error", message: "share link needs both ?chain= and &mint=" };
  }
  const chain = Chain.safeParse(chainRaw);
  if (!chain.success) {
    return { kind: "error", message: `unknown chain "${chainRaw}" — expected solana or robinhood` };
  }
  if (!isValidAddress(chain.data, mint)) {
    return {
      kind: "error",
      message: `"${mint.slice(0, 24)}…" is not a valid ${chain.data} address`,
    };
  }
  return { kind: "token", chain: chain.data, mint };
}

export function buildDeepLink(chain: Chain, mint: string): string {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ chain, mint }).toString();
  url.hash = "";
  return url.toString();
}
