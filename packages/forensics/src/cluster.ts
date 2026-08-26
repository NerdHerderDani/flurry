import type { SlotActivity } from "./schemas.js";

export interface FundingCluster {
  funder: string;
  wallets: string[];
}

/**
 * Groups buyer wallets by common funding source. A single funder feeding
 * multiple "independent" buyers is the linked-wallet signature.
 * Returns clusters of size >= 2, largest first.
 */
export function clusterByFunding(activity: readonly SlotActivity[]): FundingCluster[] {
  const byFunder = new Map<string, Set<string>>();
  for (const a of activity) {
    if (!a.fundedBy) continue;
    const set = byFunder.get(a.fundedBy) ?? new Set<string>();
    set.add(a.wallet);
    byFunder.set(a.fundedBy, set);
  }
  return [...byFunder.entries()]
    .filter(([, w]) => w.size >= 2)
    .map(([funder, w]) => ({ funder, wallets: [...w].sort() }))
    .sort((a, b) => b.wallets.length - a.wallets.length);
}

/** Total wallets that share funding lineage with at least one other wallet. */
export function linkedWalletCount(clusters: readonly FundingCluster[]): number {
  return clusters.reduce((s, c) => s + c.wallets.length, 0);
}
