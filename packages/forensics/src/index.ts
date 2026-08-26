/**
 * @flurry/forensics — the token-launch forensics engine that powers FLURRY 慌.
 *
 * Pure, deterministic functions over caller-supplied evidence. No network, no
 * DOM, no keys — bring your own transport via the ChainProvider interface.
 *
 * Honesty invariants (API guarantees, semver-protected):
 * - Unknown renders as unknown: unverifiable fields are flagged
 *   (`rugHistoryVerified`, `volHoldersVerified`), never fabricated, and
 *   explainRisk names them "unverified" in plain English.
 * - No fabricated signals: every output is a deterministic function of the
 *   evidence you pass in.
 * - Heuristic threshold changes are documented minor versions.
 */
export { detectBundle, type BundleReport } from "./bundle.js";
export { clusterByFunding, linkedWalletCount, type FundingCluster } from "./cluster.js";
export { scoreRisk, type RiskInput, type RiskTier } from "./risk.js";
export { explainRisk, type ExplainInput, type LocalVerdict } from "./explain.js";
export {
  Chain,
  isValidAddress,
  LaunchProgram,
  SlotActivity,
  Launch,
  GraduationEntry,
  RugcheckEvidenceSection,
  DossierEvidence,
} from "./schemas.js";
export type { ChainProvider } from "./provider.js";
export { createDemoProvider } from "./demo.js";
