import { describe, expect, it } from "vitest";
import { RugcheckReport, RugcheckSummary } from "./schemas";
import { buildCrossCheck, toEvidenceSection } from "./crossCheck";
// Real captured responses for the JTO mint, 2026-08-25 (api.rugcheck.xyz).
// The report fixture's `markets`/`topHolders` arrays are trimmed for repo
// size; every field this module reads is untouched.
import summaryJto from "./__fixtures__/summary-jto.json";
import reportJto from "./__fixtures__/report-jto-trimmed.json";

describe("RugCheck cross-check from real captured responses", () => {
  const summary = RugcheckSummary.parse(summaryJto);
  const report = RugcheckReport.parse(reportJto);
  const cc = buildCrossCheck(summary, report);

  it("parses and maps the captured JTO responses", () => {
    expect(cc.rugged).toBe(false);
    expect(cc.riskScoreNormalised).toBe(30);
    expect(cc.risks.map((r) => r.name)).toEqual(["Single holder ownership", "Mutable metadata"]);
    expect(cc.insiderNetworkCount).toBe(3);
    expect(cc.insiderNetworkMaxSize).toBe(2474);
    expect(cc.graphInsidersDetected).toBe(2492);
    // creatorTokens is null for JTO — must surface as "not provided", never 0.
    expect(cc.creatorTokenCount).toBeNull();
  });

  it("produces a numbers-and-booleans-only evidence section", () => {
    const ev = toEvidenceSection(cc);
    expect(ev.source).toBe("rugcheck.xyz");
    expect(ev.rugged).toBe(false);
    expect(ev.riskCount).toBe(2);
    expect(ev.dangerRisks).toBe(0);
    expect(ev.warnRisks).toBe(2);
    // The injection wall: no field may be a free-text string.
    for (const [k, v] of Object.entries(ev)) {
      if (k === "source") continue;
      expect(["number", "boolean"].includes(typeof v) || v === null, `${k} leaks text`).toBe(true);
    }
  });

  it("tolerates additive upstream fields and missing optionals", () => {
    const minimal = RugcheckReport.parse({
      rugged: true,
      score_normalised: 99,
      surprise_new_field: "ignored",
    });
    const cc2 = buildCrossCheck(
      RugcheckSummary.parse({ risks: [], score: 0, score_normalised: 1 }),
      minimal,
    );
    expect(cc2.rugged).toBe(true);
    expect(cc2.insiderNetworkCount).toBe(0);
    expect(cc2.lpLockedPct).toBeNull();
  });
});
