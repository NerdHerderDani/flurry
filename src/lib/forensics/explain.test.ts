import { describe, expect, it } from "vitest";
import { explainRisk, type ExplainInput } from "./explain";
import { scoreRisk } from "./risk";

const base: ExplainInput = {
  bundled: false,
  bundleWallets: 0,
  firstBlockSupplyPct: 5,
  linkedWallets: 0,
  deployerPriorLaunches: 0,
  deployerPriorRugs: 0,
  rugHistoryVerified: true,
  devHoldsPct: 3,
  tier: "LOW",
};

const joined = (i: ExplainInput) => explainRisk(i).sentences.join(" ");

describe("explainRisk — signal matrix", () => {
  it("bundled + clustered reads as one person pretending to be a crowd", () => {
    const v = explainRisk({
      ...base,
      bundled: true,
      bundleWallets: 14,
      clusterSize: 14,
      linkedWallets: 14,
      tier: "CRITICAL",
    });
    expect(v.headline).toBe("High risk.");
    expect(v.sentences[0]).toContain("14 wallets bought in the same instant");
    expect(v.sentences[0]).toContain("all funded by one wallet");
    expect(v.sentences[0]).toContain("one person pretending to be a crowd");
  });

  it("bundled without clustering still calls out the bundle", () => {
    const v = explainRisk({ ...base, bundled: true, bundleWallets: 6, tier: "HIGH" });
    expect(v.sentences[0]).toContain("6 wallets bought in the same instant");
    expect(v.sentences[0]).not.toContain("funded by one wallet");
  });

  it("clean + unclustered says so plainly", () => {
    const v = explainRisk(base);
    expect(v.headline).toBe("Lower risk, not no risk.");
    expect(v.sentences[0]).toBe("Clean deploy, no wallet clustering found.");
  });

  it("clustering without bundling gets its own sentence", () => {
    const v = explainRisk({ ...base, linkedWallets: 8, tier: "MODERATE" });
    expect(v.sentences[0]).toContain("8 buyer wallets share funding lineage");
  });

  it("first-block concentration tiers into the prose", () => {
    expect(joined({ ...base, firstBlockSupplyPct: 42 })).toContain("heavy early concentration");
    expect(joined({ ...base, firstBlockSupplyPct: 20 })).toContain(
      "20% of the supply went in the first block",
    );
    expect(joined({ ...base, firstBlockSupplyPct: 5 })).not.toContain("first block");
  });

  it("verified rug history is stated with counts", () => {
    expect(
      joined({ ...base, deployerPriorLaunches: 4, deployerPriorRugs: 2, tier: "MODERATE" }),
    ).toContain("2 prior rugs on record across 4 launches");
    // Inconsistent upstream counts (rugs with no launch count) must not read
    // as "5 rugs across 0 launches" — found visually in the 375px audit.
    expect(
      joined({ ...base, deployerPriorLaunches: 0, deployerPriorRugs: 5, tier: "HIGH" }),
    ).toContain("5 prior rugs on record.");
    expect(joined({ ...base, deployerPriorLaunches: 3 })).toContain(
      "3 prior launches and no rugs on record",
    );
    expect(joined(base)).toContain("First launch from this deployer");
  });
});

describe("explainRisk — honesty law (load-bearing)", () => {
  it('the word "unverified" survives into the plain English when rug history is unverified', () => {
    const v = explainRisk({ ...base, rugHistoryVerified: false, deployerPriorLaunches: 2 });
    expect(v.sentences.join(" ")).toContain("unverified");
  });

  it("unverified rug history is never papered over as a clean record", () => {
    const text = joined({ ...base, rugHistoryVerified: false, deployerPriorRugs: 0 });
    expect(text).not.toContain("no rugs on record");
    expect(text).toContain("absence of a record is not a clean record");
  });

  it('every unverified permutation of the matrix says "unverified"', () => {
    for (const bundled of [true, false]) {
      for (const linkedWallets of [0, 8]) {
        const input: ExplainInput = {
          ...base,
          bundled,
          bundleWallets: bundled ? 6 : 0,
          linkedWallets,
          rugHistoryVerified: false,
          tier: scoreRisk({
            bundled,
            firstBlockSupplyPct: base.firstBlockSupplyPct,
            linkedWallets,
            deployerPriorRugs: 0,
            devHoldsPct: base.devHoldsPct,
          }).tier,
        };
        expect(joined(input), JSON.stringify(input)).toContain("unverified");
      }
    }
  });
});

describe("explainRisk — RugCheck attribution", () => {
  it("references RugCheck with attribution, never merging scores", () => {
    const v = explainRisk({
      ...base,
      rugcheck: { rugged: false, riskScoreNormalised: 71, dangerRisks: 2 },
    });
    const text = v.sentences.join(" ");
    expect(text).toContain("RugCheck also flags 2 danger-level risks");
    expect(text).toContain("71/100");
    // Our tier is untouched by their score.
    expect(v.tier).toBe("LOW");
    expect(v.headline).toBe("Lower risk, not no risk.");
  });

  it("a rugcheck rugged flag is stated with attribution", () => {
    expect(
      joined({ ...base, rugcheck: { rugged: true, riskScoreNormalised: 95, dangerRisks: 4 } }),
    ).toContain("RugCheck has already marked this token rugged");
  });

  it("says nothing about RugCheck when the cross-check is absent", () => {
    expect(joined(base)).not.toContain("RugCheck");
  });
});

describe("explainRisk — determinism", () => {
  it("same input, same output", () => {
    const input: ExplainInput = {
      ...base,
      bundled: true,
      bundleWallets: 9,
      clusterSize: 4,
      tier: "HIGH",
    };
    expect(explainRisk(input)).toEqual(explainRisk(input));
  });
});
