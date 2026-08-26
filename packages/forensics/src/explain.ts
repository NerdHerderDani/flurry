import type { RiskTier } from "./risk.js";

/**
 * The local verdict: Flurry's already-computed signals rendered as plain
 * English. Pure, template-based, deterministic — the free tier of the verdict
 * feature (the AI dossier is the deeper read). Honesty law applies inside the
 * prose: unverified fields are named as unverified, never papered over.
 */
export interface ExplainInput {
  bundled: boolean;
  bundleWallets: number;
  firstBlockSupplyPct: number;
  linkedWallets: number;
  /** Size of the largest common-funder cluster, when one exists. */
  clusterSize?: number;
  deployerPriorLaunches: number;
  deployerPriorRugs: number;
  rugHistoryVerified: boolean;
  devHoldsPct: number;
  tier: RiskTier;
  /** Present only when the RugCheck cross-check has loaded. Attribution only — never merged into our tier. */
  rugcheck?: {
    rugged: boolean;
    riskScoreNormalised: number;
    dangerRisks: number;
  } | null;
}

export interface LocalVerdict {
  /** One-line plain-English risk summary, e.g. "High risk." */
  headline: string;
  /** 2–4 short sentences interpreting the signals. */
  sentences: string[];
  tier: RiskTier;
}

const TIER_HEADLINE: Record<RiskTier, string> = {
  CRITICAL: "High risk.",
  HIGH: "High risk.",
  MODERATE: "Some warning signs.",
  LOW: "Lower risk, not no risk.",
};

export function explainRisk(i: ExplainInput): LocalVerdict {
  const sentences: string[] = [];

  // Bundling + clustering are the strongest story — tell it first.
  if (i.bundled) {
    const funder =
      i.clusterSize && i.clusterSize > 1
        ? `, ${i.clusterSize === i.bundleWallets ? "all" : `${i.clusterSize} of them`} funded by one wallet`
        : "";
    sentences.push(
      `${i.bundleWallets} wallets bought in the same instant this launched${funder}. That is usually one person pretending to be a crowd.`,
    );
  } else if (i.linkedWallets > 5) {
    sentences.push(
      `Clean deploy slot, but ${i.linkedWallets} buyer wallets share funding lineage — they trace back to the same source, which can mean one buyer wearing many masks.`,
    );
  } else {
    sentences.push("Clean deploy, no wallet clustering found.");
  }

  if (i.firstBlockSupplyPct > 30) {
    sentences.push(
      `${i.firstBlockSupplyPct}% of the supply was grabbed in the first block — heavy early concentration.`,
    );
  } else if (i.firstBlockSupplyPct > 15) {
    sentences.push(`${i.firstBlockSupplyPct}% of the supply went in the first block.`);
  }

  // Deployer history — the honesty law lives here: unverified is said out loud.
  if (i.rugHistoryVerified) {
    if (i.deployerPriorRugs > 0) {
      const across =
        i.deployerPriorLaunches >= i.deployerPriorRugs
          ? ` across ${i.deployerPriorLaunches} launch${i.deployerPriorLaunches === 1 ? "" : "es"}`
          : "";
      sentences.push(
        `The deployer has ${i.deployerPriorRugs} prior rug${i.deployerPriorRugs === 1 ? "" : "s"} on record${across}.`,
      );
    } else if (i.deployerPriorLaunches > 0) {
      sentences.push(
        `The deployer has ${i.deployerPriorLaunches} prior launch${i.deployerPriorLaunches === 1 ? "" : "es"} and no rugs on record.`,
      );
    } else {
      sentences.push("First launch from this deployer, no history to judge.");
    }
  } else {
    sentences.push(
      `The deployer has ${i.deployerPriorLaunches} visible prior launch${i.deployerPriorLaunches === 1 ? "" : "es"}, but rug history is unverified without an indexer — absence of a record is not a clean record.`,
    );
  }

  if (i.devHoldsPct > 8) {
    sentences.push(`The dev holds ${i.devHoldsPct}% of the supply.`);
  }

  // RugCheck: attribution only, never merged into our tier.
  if (i.rugcheck) {
    if (i.rugcheck.rugged) {
      sentences.push("RugCheck has already marked this token rugged.");
    } else if (i.rugcheck.dangerRisks > 0) {
      sentences.push(
        `RugCheck also flags ${i.rugcheck.dangerRisks} danger-level risk${i.rugcheck.dangerRisks === 1 ? "" : "s"} on this token (their score: ${i.rugcheck.riskScoreNormalised}/100).`,
      );
    } else {
      sentences.push(
        `RugCheck's independent score: ${i.rugcheck.riskScoreNormalised}/100 (their scale, higher is riskier).`,
      );
    }
  }

  return { headline: TIER_HEADLINE[i.tier], sentences, tier: i.tier };
}
