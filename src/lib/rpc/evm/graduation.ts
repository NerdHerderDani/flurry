import type { SwapEvent } from "./decode";
import type { GraduationEntry, LaunchProgram } from "../../schemas";

export interface TrackedTokenMeta {
  mint: string;
  ticker: string;
  program: LaunchProgram;
  platformLabel: string;
  totalSupply: bigint;
}

/**
 * pools.trade is a direct-pool launchpad (see DECODING.md) — there is no
 * bonding curve to make progress on, so every token is GRADUATED the instant
 * its TokenCreated event is observed. mcapUsd reflects price at listing (from
 * the bundled creator swap in the same transaction, when present) — this
 * provider does not re-poll Uniswap v4 pool state for already-graduated
 * tokens in v1; a documented simplification, not a bug (see DECODING.md).
 */
export function buildGraduationEntry(
  meta: TrackedTokenMeta,
  mcapUsd: number,
  pinned: boolean,
): GraduationEntry {
  return {
    chain: "robinhood",
    mint: meta.mint,
    ticker: meta.ticker,
    program: meta.program,
    platformLabel: meta.platformLabel,
    curveProgressPct: 100,
    mcapUsd,
    vol1hUsd: 0,
    holders: 0,
    volHoldersVerified: false,
    pinned,
  };
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

/**
 * Fully-diluted valuation from the pool's currency0=native-ETH convention
 * (verified live — every pools.trade instant-launch pool uses the zero
 * address for currency0 and the new token for currency1). Decimals cancel:
 * both amount1 and totalSupply are the token's own raw base units.
 */
export function computeMcapUsdFromSwap(
  swap: SwapEvent,
  totalSupply: bigint,
  ethUsdPrice: number,
): number {
  if (swap.amount1 === 0n || totalSupply <= 0n) return 0;
  const fdvWei = (absBigInt(swap.amount0) * totalSupply) / absBigInt(swap.amount1);
  return (Number(fdvWei) / 1e18) * ethUsdPrice;
}
