import { describe, expect, it } from "vitest";
import { scoreRisk } from "./risk.js";

describe("scoreRisk", () => {
  it("clean launch scores LOW", () => {
    expect(
      scoreRisk({
        bundled: false,
        firstBlockSupplyPct: 5,
        linkedWallets: 0,
        deployerPriorRugs: 0,
        devHoldsPct: 3,
      }).tier,
    ).toBe("LOW");
  });

  it("bundled + concentrated + serial rugger scores CRITICAL", () => {
    expect(
      scoreRisk({
        bundled: true,
        firstBlockSupplyPct: 45,
        linkedWallets: 12,
        deployerPriorRugs: 5,
        devHoldsPct: 10,
      }).tier,
    ).toBe("CRITICAL");
  });

  it("bundling alone lands HIGH (4 points)", () => {
    const r = scoreRisk({
      bundled: true,
      firstBlockSupplyPct: 0,
      linkedWallets: 0,
      deployerPriorRugs: 0,
      devHoldsPct: 0,
    });
    expect(r.score).toBe(4);
    expect(r.tier).toBe("HIGH");
  });

  it("boundary: score 2 is MODERATE, score 1 is LOW", () => {
    expect(
      scoreRisk({
        bundled: false,
        firstBlockSupplyPct: 20,
        linkedWallets: 6,
        deployerPriorRugs: 0,
        devHoldsPct: 0,
      }).tier,
    ).toBe("MODERATE");
    expect(
      scoreRisk({
        bundled: false,
        firstBlockSupplyPct: 20,
        linkedWallets: 0,
        deployerPriorRugs: 0,
        devHoldsPct: 0,
      }).tier,
    ).toBe("LOW");
  });
});
