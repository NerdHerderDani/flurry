export type RiskTier = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface RiskInput {
  bundled: boolean;
  firstBlockSupplyPct: number;
  linkedWallets: number;
  deployerPriorRugs: number;
  devHoldsPct: number;
}

/**
 * Weighted additive score -> tier. Bundling weighs heaviest, then first-block
 * concentration and deployer rug history. Pure function; the weights are the
 * product's opinion and live here so they are testable and reviewable in one place.
 */
export function scoreRisk(i: RiskInput): { score: number; tier: RiskTier } {
  let s = 0;
  if (i.bundled) s += 4;
  if (i.firstBlockSupplyPct > 30) s += 3;
  else if (i.firstBlockSupplyPct > 15) s += 1;
  if (i.linkedWallets > 5) s += 2;
  if (i.deployerPriorRugs > 2) s += 3;
  else if (i.deployerPriorRugs > 0) s += 1;
  if (i.devHoldsPct > 8) s += 1;
  const tier: RiskTier = s >= 7 ? "CRITICAL" : s >= 4 ? "HIGH" : s >= 2 ? "MODERATE" : "LOW";
  return { score: s, tier };
}
