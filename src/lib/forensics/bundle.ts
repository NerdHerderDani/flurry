import type { SlotActivity } from "../schemas";

export interface BundleReport {
  bundled: boolean;
  /** wallets that bought in the deploy slot */
  deploySlotWallets: number;
  /** % of supply acquired in the deploy slot */
  deploySlotSupplyPct: number;
}

/**
 * Bundle heuristic: N distinct wallets acquiring supply in the exact deploy slot
 * is the signature of a bundler (Jito-bundle-style atomic buys or same-block spam).
 * Thresholds are deliberately conservative; tune with labeled data.
 */
export function detectBundle(
  deploySlot: number,
  activity: readonly SlotActivity[],
  opts: { minWallets?: number; minSupplyPct?: number } = {},
): BundleReport {
  const minWallets = opts.minWallets ?? 4;
  const minSupplyPct = opts.minSupplyPct ?? 15;
  const inSlot = activity.filter((a) => a.slot === deploySlot);
  const wallets = new Set(inSlot.map((a) => a.wallet));
  const supplyPct = inSlot.reduce((s, a) => s + a.supplyPct, 0);
  return {
    bundled: wallets.size >= minWallets && supplyPct >= minSupplyPct,
    deploySlotWallets: wallets.size,
    deploySlotSupplyPct: Math.round(supplyPct * 10) / 10,
  };
}
