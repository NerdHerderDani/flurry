import { z } from "zod";

/** Which chain a Launch/GraduationEntry came from. Defaults to "solana" for back-compat. */
export const Chain = z.enum(["solana", "robinhood"]);
export type Chain = z.infer<typeof Chain>;

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Per-chain address shape check — tightened here rather than loosened globally. */
export function isValidAddress(chain: Chain, address: string): boolean {
  return chain === "solana" ? SOLANA_ADDRESS_RE.test(address) : EVM_ADDRESS_RE.test(address);
}

/**
 * Coverage is program-oriented, not brand-oriented: most "launchpads" are skins
 * on shared infrastructure (LetsBonk et al. on Raydium LaunchLab; Believe/Bags
 * on Meteora DBC). One decoder per program covers every skin on it.
 */
export const LaunchProgram = z.enum(["PUMP_FUN", "LAUNCHLAB", "METEORA_DBC", "POOLS_TRADE"]);
export type LaunchProgram = z.infer<typeof LaunchProgram>;

/** A wallet's activity in/around the deploy slot of a token. */
export const SlotActivity = z.object({
  wallet: z.string().min(1),
  /** Solana slot, or EVM block number — an opaque "deploy unit" to forensics. */
  slot: z.number().int().nonnegative(),
  supplyPct: z.number().min(0).max(100),
  fundedBy: z.string().min(1).optional(),
});
export type SlotActivity = z.infer<typeof SlotActivity>;

export const Launch = z
  .object({
    chain: Chain.default("solana"),
    mint: z.string(),
    ticker: z.string(),
    name: z.string(),
    program: LaunchProgram,
    /** Display name of the launchpad skin (e.g. "PUMP.FUN", "LETSBONK", "BELIEVE"). */
    platformLabel: z.string(),
    deployer: z.string(),
    /** Solana slot, or EVM block number — see SlotActivity.slot. */
    deploySlot: z.number().int().nonnegative(),
    launchedAt: z.number(), // unix ms
    mcapUsd: z.number().nonnegative(),
    devHoldsPct: z.number().min(0).max(100),
    deployerPriorLaunches: z.number().int().nonnegative(),
    deployerPriorRugs: z.number().int().nonnegative(),
    /** False on any provider that cannot verify prior-rug history client-side (see DECODING.md). */
    rugHistoryVerified: z.boolean(),
    slotActivity: z.array(SlotActivity),
  })
  .superRefine((val, ctx) => {
    if (!isValidAddress(val.chain, val.mint)) {
      ctx.addIssue({
        code: "custom",
        path: ["mint"],
        message: `mint is not a valid ${val.chain} address`,
      });
    }
    if (!isValidAddress(val.chain, val.deployer)) {
      ctx.addIssue({
        code: "custom",
        path: ["deployer"],
        message: `deployer is not a valid ${val.chain} address`,
      });
    }
    val.slotActivity.forEach((a, i) => {
      if (!isValidAddress(val.chain, a.wallet)) {
        ctx.addIssue({
          code: "custom",
          path: ["slotActivity", i, "wallet"],
          message: `wallet is not a valid ${val.chain} address`,
        });
      }
      if (a.fundedBy !== undefined && !isValidAddress(val.chain, a.fundedBy)) {
        ctx.addIssue({
          code: "custom",
          path: ["slotActivity", i, "fundedBy"],
          message: `fundedBy is not a valid ${val.chain} address`,
        });
      }
    });
  });
export type Launch = z.infer<typeof Launch>;

export const GraduationEntry = z
  .object({
    chain: Chain.default("solana"),
    mint: z.string(),
    ticker: z.string(),
    program: LaunchProgram,
    platformLabel: z.string(),
    curveProgressPct: z.number().min(0).max(100),
    mcapUsd: z.number().nonnegative(),
    vol1hUsd: z.number().nonnegative(),
    holders: z.number().int().nonnegative(),
    /** False on any provider that cannot verify vol1hUsd/holders client-side (see DECODING.md). */
    volHoldersVerified: z.boolean(),
    pinned: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (!isValidAddress(val.chain, val.mint)) {
      ctx.addIssue({
        code: "custom",
        path: ["mint"],
        message: `mint is not a valid ${val.chain} address`,
      });
    }
  });
export type GraduationEntry = z.infer<typeof GraduationEntry>;

/**
 * Optional third-party cross-check section of dossier evidence. Numbers and
 * booleans ONLY (plus the fixed source literal) — no RugCheck-authored free
 * text may ever cross the AI prompt boundary. Mirrored by hand in
 * bridge/flurry-bridge.mjs validation; keep the two in sync.
 */
export const RugcheckEvidenceSection = z.object({
  source: z.literal("rugcheck.xyz"),
  rugged: z.boolean(),
  riskScoreNormalised: z.number().int().min(0).max(100),
  riskCount: z.number().int().nonnegative(),
  dangerRisks: z.number().int().nonnegative(),
  warnRisks: z.number().int().nonnegative(),
  lpLockedPct: z.number().min(0).max(100).nullable(),
  insiderNetworkCount: z.number().int().nonnegative(),
  insiderNetworkMaxSize: z.number().int().nonnegative(),
});
export type RugcheckEvidenceSection = z.infer<typeof RugcheckEvidenceSection>;

/** Structured evidence handed to the AI dossier. Nothing else crosses that boundary. */
export const DossierEvidence = z.object({
  chain: Chain,
  ticker: z.string(),
  platformLabel: z.string(),
  deployer: z.string(),
  bundled: z.boolean(),
  bundleWallets: z.number().int().nonnegative(),
  firstBlockSupplyPct: z.number().min(0).max(100),
  linkedWallets: z.number().int().nonnegative(),
  deployerPriorLaunches: z.number().int().nonnegative(),
  deployerPriorRugs: z.number().int().nonnegative(),
  devHoldsPct: z.number().min(0).max(100),
  rugcheck: RugcheckEvidenceSection.optional(),
});
export type DossierEvidence = z.infer<typeof DossierEvidence>;
