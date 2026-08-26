import { describe, expect, it } from "vitest";
import { detectBundle } from "./bundle.js";
import type { SlotActivity } from "./schemas.js";

const W = (n: number) => `wallet_${n}`.padEnd(32, "x");
const act = (wallet: string, slot: number, supplyPct: number, fundedBy?: string): SlotActivity =>
  fundedBy === undefined ? { wallet, slot, supplyPct } : { wallet, slot, supplyPct, fundedBy };

describe("detectBundle", () => {
  it("flags many wallets buying meaningful supply in the deploy slot", () => {
    const a = [act(W(1), 100, 6), act(W(2), 100, 5), act(W(3), 100, 4), act(W(4), 100, 3)];
    const r = detectBundle(100, a);
    expect(r.bundled).toBe(true);
    expect(r.deploySlotWallets).toBe(4);
    expect(r.deploySlotSupplyPct).toBe(18);
  });

  it("does not flag organic trickle across later slots", () => {
    const a = [act(W(1), 100, 2), act(W(2), 101, 3), act(W(3), 102, 3), act(W(4), 103, 5)];
    expect(detectBundle(100, a).bundled).toBe(false);
  });

  it("does not flag few wallets even with high supply (single sniper != bundle)", () => {
    const a = [act(W(1), 100, 40)];
    const r = detectBundle(100, a);
    expect(r.bundled).toBe(false);
    expect(r.deploySlotSupplyPct).toBe(40);
  });

  it("dedupes repeat buys from the same wallet in-slot", () => {
    const a = [act(W(1), 100, 5), act(W(1), 100, 5), act(W(2), 100, 5), act(W(3), 100, 5)];
    expect(detectBundle(100, a).deploySlotWallets).toBe(3);
  });
});
