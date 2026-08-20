import { describe, expect, it } from "vitest";
import { clusterByFunding, linkedWalletCount } from "./cluster";
import type { SlotActivity } from "../schemas";

const W = (n: string) => n.padEnd(32, "x");
const act = (wallet: string, fundedBy?: string): SlotActivity =>
  fundedBy === undefined
    ? { wallet: W(wallet), slot: 1, supplyPct: 1 }
    : { wallet: W(wallet), slot: 1, supplyPct: 1, fundedBy: W(fundedBy) };

describe("clusterByFunding", () => {
  it("groups wallets sharing a funder, largest cluster first", () => {
    const a = [
      act("a", "funder1"),
      act("b", "funder1"),
      act("c", "funder1"),
      act("d", "funder2"),
      act("e", "funder2"),
      act("f"), // no lineage
      act("g", "funder3"), // singleton — not a cluster
    ];
    const clusters = clusterByFunding(a);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.wallets).toHaveLength(3);
    expect(clusters[1]?.wallets).toHaveLength(2);
    expect(linkedWalletCount(clusters)).toBe(5);
  });

  it("returns empty for organic buyers", () => {
    expect(clusterByFunding([act("a"), act("b")])).toEqual([]);
  });
});
