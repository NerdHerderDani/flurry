import { z } from "zod";

/**
 * Coverage is program-oriented, not brand-oriented: most "launchpads" are skins
 * on shared infrastructure (LetsBonk et al. on Raydium LaunchLab; Believe/Bags
 * on Meteora DBC). One decoder per program covers every skin on it.
 */
export const LaunchProgram = z.enum(["PUMP_FUN", "LAUNCHLAB", "METEORA_DBC"]);
export type LaunchProgram = z.infer<typeof LaunchProgram>;

/** A wallet's activity in/around the deploy slot of a token. */
export const SlotActivity = z.object({
  wallet: z.string().min(32),
  slot: z.number().int().nonnegative(),
  supplyPct: z.number().min(0).max(100),
  fundedBy: z.string().min(32).optional(),
});
export type SlotActivity = z.infer<typeof SlotActivity>;

export const Launch = z.object({
  mint: z.string(),
  ticker: z.string(),
  name: z.string(),
  program: LaunchProgram,
  /** Display name of the launchpad skin (e.g. "PUMP.FUN", "LETSBONK", "BELIEVE"). */
  platformLabel: z.string(),
  deployer: z.string(),
  deploySlot: z.number().int().nonnegative(),
  launchedAt: z.number(), // unix ms
  mcapUsd: z.number().nonnegative(),
  devHoldsPct: z.number().min(0).max(100),
  deployerPriorLaunches: z.number().int().nonnegative(),
  deployerPriorRugs: z.number().int().nonnegative(),
  slotActivity: z.array(SlotActivity),
});
export type Launch = z.infer<typeof Launch>;

export const GraduationEntry = z.object({
  mint: z.string(),
  ticker: z.string(),
  program: LaunchProgram,
  platformLabel: z.string(),
  curveProgressPct: z.number().min(0).max(100),
  mcapUsd: z.number().nonnegative(),
  vol1hUsd: z.number().nonnegative(),
  holders: z.number().int().nonnegative(),
  pinned: z.boolean().default(false),
});
export type GraduationEntry = z.infer<typeof GraduationEntry>;

/** Structured evidence handed to the AI dossier. Nothing else crosses that boundary. */
export const DossierEvidence = z.object({
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
});
export type DossierEvidence = z.infer<typeof DossierEvidence>;
