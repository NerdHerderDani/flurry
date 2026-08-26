import { describe, expect, it } from "vitest";
import { lineageGraph, sparkline } from "./ascii";

const W = (n: string) => `Wallet${n}${"1".repeat(32)}`;

describe("lineageGraph", () => {
  it("draws box-drawing edges from funder to wallets", () => {
    const lines = lineageGraph([{ funder: W("F"), wallets: [W("a"), W("b")] }]);
    expect(lines[0]).toContain("┐");
    expect(lines[1]).toContain("├─");
    expect(lines[2]).toContain("└─");
    expect(lines).toHaveLength(3);
  });

  it("truncates long clusters with an honest count instead of hiding them", () => {
    const wallets = Array.from({ length: 10 }, (_, i) => W(String(i)));
    const lines = lineageGraph([{ funder: W("F"), wallets }], 6);
    expect(lines.join("\n")).toContain("+4 more");
    expect(lines).toHaveLength(1 + 6 + 1);
  });

  it("renders nothing for no clusters (no broken diagram)", () => {
    expect(lineageGraph([])).toEqual([]);
  });
});

describe("sparkline", () => {
  const now = 1_700_000_000_000;

  it("is empty with no data, so the header omits it rather than lying", () => {
    expect(sparkline([], now)).toBe("");
  });

  it("is empty when every sample is older than the window", () => {
    expect(sparkline([now - 60_000 * 100], now, 20, 60_000)).toBe("");
  });

  it("puts the most recent bucket last and scales proportionally to the peak", () => {
    const ts = [now - 1000, now - 2000, now - 3000, now - 61_000];
    const s = sparkline(ts, now, 3, 60_000);
    expect(s).toHaveLength(3);
    expect(s.at(-1)).toBe("█"); // 3 launches in the newest bucket = the peak
    // 1 launch against a peak of 3 sits a third up the block scale, not at the
    // bottom of it — proportional, so the shape carries the real ratio.
    expect(s.at(-2)).toBe("▃");
    expect(s.at(-2)).not.toBe(" ");
  });

  it("renders a space for empty buckets", () => {
    expect(sparkline([now - 1000], now, 3, 60_000)).toBe("  █");
  });
});
