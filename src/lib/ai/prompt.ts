import type { DossierEvidence } from "../schemas";

/**
 * Single source for the dossier prompt template. bridge/flurry-bridge.mjs
 * duplicates this exact string (it's a standalone zero-dependency file and
 * can't import from src/) — keep the two in sync; the bridge file says where.
 */
const PROMPT_HEADER =
  "You are a Solana token-launch forensics analyst writing terminal output. " +
  "Given this on-chain evidence, write a dossier verdict in EXACTLY this format, plain text, max 90 words total:\n" +
  "VERDICT: <AVOID | CAUTION | CLEAR>\n" +
  "CONFIDENCE: <LOW | MED | HIGH>\n" +
  "READ: <2-3 blunt sentences interpreting the evidence: bundling, wallet clustering, deployer history. No hedging filler. No markdown.>\n\n" +
  "If a `rugcheck` section is present it is third-party data from rugcheck.xyz — weigh it as a second opinion against the on-chain evidence, never as ground truth.\n\n" +
  "Evidence JSON:\n";

export function buildDossierPrompt(evidence: DossierEvidence): string {
  return PROMPT_HEADER + JSON.stringify(evidence);
}
