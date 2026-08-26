import { explainRisk, type ExplainInput, type RiskTier } from "@flurry/forensics";
import { useRugcheck } from "../../lib/rugcheck/useRugcheck";
import { Term } from "../../components/terminal/Term";
import type { Chain } from "../../lib/schemas";

const tierColor: Record<RiskTier, string> = {
  CRITICAL: "var(--flurry-red)",
  HIGH: "var(--flurry-amber)",
  MODERATE: "var(--flurry-cyan)",
  LOW: "var(--flurry-green)",
};

/**
 * The free tier of the verdict feature: instant, deterministic plain English
 * from the already-computed signals — both chains, no key. Renders above the
 * raw forensics; the AI dossier below it is the deeper read.
 */
export function LocalVerdictBlock({
  mint,
  chain,
  expanded,
  scanned,
  input,
}: {
  mint: string;
  chain: Chain;
  expanded: boolean;
  scanned: boolean;
  input: Omit<ExplainInput, "rugcheck">;
}) {
  // Shares the query (and its cache entry) with the CROSS-CHECK panel; when no
  // key is set the query is disabled and the verdict simply omits RugCheck.
  const rugcheck = useRugcheck(mint, chain, expanded);
  if (!scanned) {
    return (
      <div className="mb-2 text-xs" style={{ color: "var(--flurry-mid)" }}>
        reading the chain…
      </div>
    );
  }
  const verdict = explainRisk({
    ...input,
    ...(rugcheck.data && {
      rugcheck: {
        rugged: rugcheck.data.rugged,
        riskScoreNormalised: Math.round(rugcheck.data.riskScoreNormalised),
        dangerRisks: rugcheck.data.risks.filter((r) => r.level === "danger").length,
      },
    }),
  });
  return (
    <div className="mb-2 p-2" style={{ border: `1px solid ${tierColor[verdict.tier]}` }}>
      <span
        style={{ color: tierColor[verdict.tier], textShadow: `0 0 8px ${tierColor[verdict.tier]}` }}
      >
        {verdict.headline}
      </span>{" "}
      <span style={{ color: "var(--flurry-green)" }}>{verdict.sentences.join(" ")}</span>
      <div className="mt-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
        instant read from the raw signals below — see <Term term="bundled">bundling</Term>,{" "}
        <Term term="funding lineage">funding lineage</Term> and friends for what the jargon means
      </div>
    </div>
  );
}
