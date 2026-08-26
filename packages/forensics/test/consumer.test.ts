/**
 * Consumer integration test: imports the BUILT package by its published name
 * (resolved through the workspace symlink to dist/, not the TypeScript
 * source), and runs the full signal matrix through the public surface —
 * proving the API works exactly as a third-party consumer would receive it.
 */
import { describe, expect, it } from "vitest";
import {
  Chain,
  DossierEvidence,
  GraduationEntry,
  Launch,
  clusterByFunding,
  createDemoProvider,
  detectBundle,
  explainRisk,
  isValidAddress,
  linkedWalletCount,
  scoreRisk,
  type ChainProvider,
  type SlotActivity,
} from "@flurry/forensics";

// Unique, base58-safe synthetic wallets (no 0/O/I/l, no index collisions).
const SAFE = "abcdefghjkmnpq";
const wallet = (n: number) =>
  `W${SAFE[n % SAFE.length]}${SAFE[Math.floor(n / SAFE.length) % SAFE.length]}${"1".repeat(35)}`;

function activity(opts: { wallets: number; slot: number; funder?: string }): SlotActivity[] {
  return Array.from({ length: opts.wallets }, (_, i) => ({
    wallet: wallet(i),
    slot: opts.slot,
    supplyPct: 2,
    ...(opts.funder && { fundedBy: opts.funder }),
  }));
}

describe("@flurry/forensics public surface (built package)", () => {
  it("full pipeline: bundled + clustered evidence → CRITICAL tier → honest plain English", () => {
    const acts = activity({ wallets: 14, slot: 100, funder: wallet(99) });
    const bundle = detectBundle(100, acts);
    expect(bundle.bundled).toBe(true);
    const clusters = clusterByFunding(acts);
    const linked = linkedWalletCount(clusters);
    expect(linked).toBe(14);
    const { tier } = scoreRisk({
      bundled: bundle.bundled,
      firstBlockSupplyPct: bundle.deploySlotSupplyPct,
      linkedWallets: linked,
      deployerPriorRugs: 3,
      devHoldsPct: 10,
    });
    expect(tier).toBe("CRITICAL");
    const verdict = explainRisk({
      bundled: bundle.bundled,
      bundleWallets: bundle.deploySlotWallets,
      firstBlockSupplyPct: bundle.deploySlotSupplyPct,
      linkedWallets: linked,
      clusterSize: clusters[0]?.wallets.length ?? 0,
      deployerPriorLaunches: 5,
      deployerPriorRugs: 3,
      rugHistoryVerified: true,
      devHoldsPct: 10,
      tier,
    });
    expect(verdict.headline).toBe("High risk.");
    expect(verdict.sentences.join(" ")).toContain("pretending to be a crowd");
  });

  it("honesty invariant survives the published surface: unverified is said out loud", () => {
    const verdict = explainRisk({
      bundled: false,
      bundleWallets: 0,
      firstBlockSupplyPct: 3,
      linkedWallets: 0,
      deployerPriorLaunches: 2,
      deployerPriorRugs: 0,
      rugHistoryVerified: false,
      devHoldsPct: 2,
      tier: "LOW",
    });
    expect(verdict.sentences.join(" ")).toContain("unverified");
  });

  it("clean evidence stays LOW across the matrix corner", () => {
    const { tier } = scoreRisk({
      bundled: false,
      firstBlockSupplyPct: 4,
      linkedWallets: 0,
      deployerPriorRugs: 0,
      devHoldsPct: 3,
    });
    expect(tier).toBe("LOW");
  });

  it("schema contract parses and rejects at the boundary", () => {
    expect(Chain.parse("solana")).toBe("solana");
    expect(isValidAddress("solana", "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL")).toBe(true);
    expect(isValidAddress("robinhood", "0x" + "1".repeat(40))).toBe(true);
    expect(() => DossierEvidence.parse({})).toThrow();
    expect(Launch).toBeDefined();
    expect(GraduationEntry).toBeDefined();
  });

  it("demo provider satisfies the ChainProvider interface end to end", async () => {
    const provider: ChainProvider = createDemoProvider();
    const launches: unknown[] = [];
    const unsub = provider.subscribeLaunches((l) => launches.push(Launch.parse(l)));
    const candidates = await provider.getGraduationCandidates();
    for (const c of candidates) GraduationEntry.parse(c);
    expect(candidates.length).toBeGreaterThan(0);
    unsub();
    provider.dispose?.();
  });
});
