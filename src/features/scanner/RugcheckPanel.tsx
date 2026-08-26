import { RugcheckError } from "../../lib/rugcheck/client";
import { useRugcheck } from "../../lib/rugcheck/useRugcheck";
import { Term } from "../../components/terminal/Term";
import type { Chain } from "../../lib/schemas";

/**
 * CROSS-CHECK panel: RugCheck's read on a token, rendered as a clearly-labeled
 * second opinion. It never feeds Flurry's own risk score. Renders nothing at
 * all without a key (strict enrichment) or on RHC rows (RugCheck is
 * Solana-only).
 */
export function RugcheckPanel({
  mint,
  chain,
  expanded,
}: {
  mint: string;
  chain: Chain;
  expanded: boolean;
}) {
  const q = useRugcheck(mint, chain, expanded);

  // Query disabled = no key or wrong chain: exactly today's behavior, no panel.
  if (q.fetchStatus === "idle" && !q.isSuccess && !q.isError) return null;

  const header = (
    <div className="mb-1" style={{ color: "var(--flurry-mid)" }}>
      CROSS-CHECK <span style={{ color: "var(--flurry-cyan)" }}>rugcheck.xyz</span> — third-party
      second opinion; does not affect the RISK column
    </div>
  );

  if (q.isPending) {
    return (
      <div className="mt-2 p-2 text-xs" style={{ border: "1px dashed var(--flurry-dim)" }}>
        {header}
        <span style={{ color: "var(--flurry-mid)" }}>fetching…</span>
      </div>
    );
  }

  if (q.isError) {
    const e = q.error;
    const msg =
      e instanceof RugcheckError
        ? e.kind === "quota"
          ? "quota / rate limit exhausted on your RugCheck plan — cross-check unavailable right now. Flurry's own verdicts are unaffected."
          : e.kind === "auth"
            ? "RugCheck key rejected — the key must be created under the RugCheck section at fluxrpc.com (an RPC key won't work). Check [F3] CONFIG."
            : `cross-check failed: ${e.message}`
        : "cross-check failed";
    return (
      <div className="mt-2 p-2 text-xs" style={{ border: "1px dashed var(--flurry-dim)" }}>
        {header}
        <span style={{ color: "var(--flurry-amber)" }}>{msg}</span>
      </div>
    );
  }

  const c = q.data;
  return (
    <div className="mt-2 p-2 text-xs" style={{ border: "1px dashed var(--flurry-dim)" }}>
      {header}
      <pre className="whitespace-pre-wrap">
        <Term term="rugged">rugged</Term>
        {`        ${c.rugged ? "⚠ RUGGED (per rugcheck)" : "no"}\n`}
        {`their score   ${Math.round(c.riskScoreNormalised)}/100 (rugcheck scale, higher = riskier)\n`}
        <Term term="lp lock">lp locked</Term>
        {`     ${c.lpLockedPct != null ? `${c.lpLockedPct.toFixed(1)}%` : "not provided"}\n`}
        <Term term="insider network">insiders</Term>
        {`      ${c.insiderNetworkCount} network(s)${c.insiderNetworkMaxSize > 0 ? ` · largest ${c.insiderNetworkMaxSize} wallets` : ""}${c.graphInsidersDetected != null ? ` · ${c.graphInsidersDetected} holders flagged` : ""}\n`}
        {`creator toks  ${c.creatorTokenCount != null ? `${c.creatorTokenCount} other token(s) by this creator` : "not provided"}`}
      </pre>
      {c.risks.length > 0 && (
        <div className="mt-1">
          {c.risks.map((r) => (
            <div key={r.name}>
              <span
                style={{
                  color:
                    r.level === "danger"
                      ? "var(--flurry-red)"
                      : r.level === "warn"
                        ? "var(--flurry-amber)"
                        : "var(--flurry-mid)",
                }}
              >
                [{r.level}]
              </span>{" "}
              {r.name}
              {r.value ? ` — ${r.value}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
