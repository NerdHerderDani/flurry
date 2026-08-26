import { z } from "zod";

/**
 * RugCheck API (api.rugcheck.xyz) response boundaries. Shapes captured live
 * 2026-08-25 from the swagger spec (dto.TokenCheckSummary, rugcheck_api.Risk)
 * and real responses — see __fixtures__/. Parsed loosely on purpose: we only
 * validate the fields we consume, so an additive upstream change can't brick
 * the cross-check panel.
 *
 * NOTE: some numeric fields upstream (e.g. insiderNetworks[].tokenAmount)
 * exceed Number.MAX_SAFE_INTEGER — never consume those without bigint
 * handling. This module deliberately reads only counts and percentages.
 */

export const RugcheckRisk = z.object({
  name: z.string(),
  value: z.string().default(""),
  description: z.string().default(""),
  score: z.number(),
  level: z.string(), // observed: "info" | "warn" | "danger" — kept open, mapped defensively
});
export type RugcheckRisk = z.infer<typeof RugcheckRisk>;

/** GET /v1/tokens/{mint}/report/summary */
export const RugcheckSummary = z.object({
  risks: z.array(RugcheckRisk).default([]),
  score: z.number(),
  score_normalised: z.number().min(0).max(100),
  lpLockedPct: z.number().min(0).max(100).nullish(),
  error: z.string().nullish(),
});
export type RugcheckSummary = z.infer<typeof RugcheckSummary>;

/** GET /v1/tokens/{mint}/report — only the slice the cross-check consumes. */
export const RugcheckReport = z.object({
  rugged: z.boolean(),
  score_normalised: z.number().min(0).max(100),
  risks: z.array(RugcheckRisk).default([]),
  graphInsidersDetected: z.number().int().nonnegative().nullish(),
  insiderNetworks: z
    .array(z.object({ id: z.string(), size: z.number().int().nonnegative() }))
    .nullish(),
  totalHolders: z.number().int().nonnegative().nullish(),
  creatorTokens: z.array(z.object({ mint: z.string() }).passthrough()).nullish(),
  detectedAt: z.string().nullish(),
});
export type RugcheckReport = z.infer<typeof RugcheckReport>;
