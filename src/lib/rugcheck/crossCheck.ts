import type { RugcheckReport, RugcheckRisk, RugcheckSummary } from "./schemas";

/**
 * The cross-check model the expanded row renders and the slice of it that may
 * enter dossier evidence. Design law: RugCheck is a second opinion — it never
 * feeds Flurry's own risk score, and only numbers/booleans (never third-party
 * free text) cross the AI prompt boundary.
 */
export interface RugcheckCrossCheck {
  rugged: boolean;
  /** RugCheck's normalised risk score, 0–100, higher = riskier. Their scale, not ours. */
  riskScoreNormalised: number;
  risks: RugcheckRisk[];
  lpLockedPct: number | null;
  insiderNetworkCount: number;
  insiderNetworkMaxSize: number;
  graphInsidersDetected: number | null;
  /** Count of other tokens by the same creator, or null when RugCheck doesn't provide it. */
  creatorTokenCount: number | null;
}

export function buildCrossCheck(
  summary: RugcheckSummary,
  report: RugcheckReport,
): RugcheckCrossCheck {
  const networks = report.insiderNetworks ?? [];
  return {
    rugged: report.rugged,
    riskScoreNormalised: report.score_normalised,
    // The summary's risks are the curated set; fall back to the report's.
    risks: summary.risks.length > 0 ? summary.risks : report.risks,
    lpLockedPct: summary.lpLockedPct ?? null,
    insiderNetworkCount: networks.length,
    insiderNetworkMaxSize: networks.reduce((m, n) => Math.max(m, n.size), 0),
    graphInsidersDetected: report.graphInsidersDetected ?? null,
    creatorTokenCount: report.creatorTokens ? report.creatorTokens.length : null,
  };
}

/**
 * The dossier evidence section: numbers and booleans ONLY, so the bridge's
 * injection wall stays exactly as strict as before — no RugCheck-authored
 * string ever reaches an AI prompt. Mirrors DossierEvidence.rugcheck in
 * ../schemas.ts and the bridge's hand validation.
 */
export interface RugcheckEvidence {
  source: "rugcheck.xyz";
  rugged: boolean;
  riskScoreNormalised: number;
  riskCount: number;
  dangerRisks: number;
  warnRisks: number;
  lpLockedPct: number | null;
  insiderNetworkCount: number;
  insiderNetworkMaxSize: number;
}

export function toEvidenceSection(c: RugcheckCrossCheck): RugcheckEvidence {
  return {
    source: "rugcheck.xyz",
    rugged: c.rugged,
    riskScoreNormalised: Math.round(c.riskScoreNormalised),
    riskCount: c.risks.length,
    dangerRisks: c.risks.filter((r) => r.level === "danger").length,
    warnRisks: c.risks.filter((r) => r.level === "warn").length,
    lpLockedPct: c.lpLockedPct,
    insiderNetworkCount: c.insiderNetworkCount,
    insiderNetworkMaxSize: c.insiderNetworkMaxSize,
  };
}
