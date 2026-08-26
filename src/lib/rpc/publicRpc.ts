import type { Chain } from "../schemas";

/**
 * Zero-setup SLOW MODE endpoints, used automatically when the user has pasted
 * nothing. null = no browser-usable public endpoint exists for that chain.
 *
 * Verified with real calls 2026-08-26, from a real browser context — which is
 * the test that matters (see DECODING.md §"Public endpoints"): Solana's
 * api.mainnet-beta.solana.com answers curl but returns 403 to browser-origin
 * traffic, and every other free public Solana endpoint tested is likewise
 * browser-blocked (CORS or key-gated). So Solana ships demo-until-key,
 * honestly, and SLOW MODE is a Robinhood Chain feature until a browser-open
 * public Solana endpoint exists. Robinhood's official public RPC answered
 * browser fetches with 200 and has no WebSocket (poll from the first tick).
 * Budgets are deliberately conservative — public endpoints are shared
 * infrastructure.
 */
export interface PublicRpcConfig {
  url: string;
  /** Conservative request budget for SLOW MODE — not the endpoint's ceiling. */
  rps: number;
  /** 1 = skip straight to polling after a single WS failure (endpoint has no WS). */
  maxWsFailures?: number;
}

export const PUBLIC_RPC: Record<Chain, PublicRpcConfig | null> = {
  solana: null,
  robinhood: { url: "https://rpc.mainnet.chain.robinhood.com", rps: 3, maxWsFailures: 1 },
};
