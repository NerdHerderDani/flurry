import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  computeCurveProgressPct,
  computeMcapUsd,
  decodeBondingCurveAccount,
  decodeCreateEventFromLogs,
  decodeGlobalInitialRealTokenReserves,
  slotActivityFromTransaction,
} from "./decode";
import type { RpcTransaction } from "./types";

const fixturesDir = fileURLToPath(new URL("../__fixtures__/pumpfun/", import.meta.url));
function loadFixture(name: string): { result: RpcTransaction } {
  return JSON.parse(readFileSync(fixturesDir + name, "utf8"));
}

describe("decodeCreateEventFromLogs", () => {
  it.each([
    ["create-v2-tx-1.json", "TROLBULL", "9dtmpyqK6gokJLVWrqPnhw6bq1kXGDJsuCoMtWQUpump"],
    ["create-v2-tx-2.json", undefined, undefined],
    ["create-v2-tx-3.json", undefined, undefined],
    ["create-v2-tx-4.json", undefined, undefined],
    ["create-v2-tx-5-legacy-buy.json", undefined, undefined],
  ])("decodes the CreateEvent out of %s", (file, expectedTicker, expectedMint) => {
    const tx = loadFixture(file).result;
    const event = decodeCreateEventFromLogs(tx.meta?.logMessages ?? []);
    expect(event).not.toBeNull();
    if (!event) return;
    expect(event.mint).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/); // valid base58, no ambiguous chars
    expect(event.bondingCurve).toBeTruthy();
    expect(event.user).toBeTruthy();
    expect(event.tokenTotalSupply).toBeGreaterThan(0n);
    expect(event.timestamp).toBeGreaterThan(1_700_000_000);
    if (expectedTicker) expect(event.symbol).toBe(expectedTicker);
    if (expectedMint) expect(event.mint).toBe(expectedMint);
  });

  it("returns null when no create event is present in the logs", () => {
    expect(decodeCreateEventFromLogs(["Program log: something unrelated"])).toBeNull();
  });

  it("returns null on empty logs", () => {
    expect(decodeCreateEventFromLogs([])).toBeNull();
  });
});

describe("decodeBondingCurveAccount", () => {
  it("decodes a freshly created curve", () => {
    const fixture = loadFixture("bonding-curve-account.json") as unknown as {
      result: { value: { data: [string, string] } };
    };
    const state = decodeBondingCurveAccount(fixture.result.value.data[0]);
    expect(state).not.toBeNull();
    if (!state) return;
    expect(state.complete).toBe(false);
    expect(state.tokenTotalSupply).toBe(1_000_000_000_000_000n);
    expect(state.realTokenReserves).toBe(793_100_000_000_000n);
    expect(state.creator).toBe("26oAvbq3jBrg8F7uDw35LMz7URE4W3jbCn3VbuBspynE");
  });

  it("rejects data with the wrong discriminator", () => {
    const bogus = Buffer.alloc(107).toString("base64");
    expect(decodeBondingCurveAccount(bogus)).toBeNull();
  });
});

describe("decodeGlobalInitialRealTokenReserves", () => {
  it("reads the graduation denominator off the Global account", () => {
    const fixture = loadFixture("global-account.json") as unknown as {
      result: { value: { data: [string, string] } };
    };
    const value = decodeGlobalInitialRealTokenReserves(fixture.result.value.data[0]);
    expect(value).toBe(793_100_000_000_000n);
  });
});

describe("computeCurveProgressPct", () => {
  const initial = 793_100_000_000_000n;

  it("is 0% at the moment of creation", () => {
    expect(computeCurveProgressPct({ realTokenReserves: initial, complete: false }, initial)).toBe(
      0,
    );
  });

  it("is 100% once the curve reports complete, regardless of reserves", () => {
    expect(computeCurveProgressPct({ realTokenReserves: 1_000n, complete: true }, initial)).toBe(
      100,
    );
  });

  it("is 100% when real_token_reserves hits zero (the documented completion condition)", () => {
    expect(computeCurveProgressPct({ realTokenReserves: 0n, complete: false }, initial)).toBe(100);
  });

  it("tracks partial draw-down linearly", () => {
    const half = initial / 2n;
    expect(
      computeCurveProgressPct({ realTokenReserves: half, complete: false }, initial),
    ).toBeCloseTo(50, 0);
  });
});

describe("computeMcapUsd", () => {
  it("scales fully-diluted valuation by the SOL/USD price", () => {
    const curve = {
      virtualQuoteReserves: 30_000_000_000n, // 30 SOL, lamports
      virtualTokenReserves: 1_073_000_000_000_000n,
      tokenTotalSupply: 1_000_000_000_000_000n,
    };
    // price/token = 30e9 / 1.073e15 lamports; * total supply / 1e9 for SOL; * $100
    const expectedSol = ((30_000_000_000 / 1_073_000_000_000_000) * 1_000_000_000_000_000) / 1e9;
    expect(computeMcapUsd(curve, 100)).toBeCloseTo(expectedSol * 100, 5);
  });

  it("is zero when virtual token reserves are zero (guards divide-by-zero)", () => {
    expect(
      computeMcapUsd(
        { virtualQuoteReserves: 1n, virtualTokenReserves: 0n, tokenTotalSupply: 1n },
        100,
      ),
    ).toBe(0);
  });
});

describe("slotActivityFromTransaction", () => {
  it("derives buy amounts from token-balance deltas, ignoring other mints and sells", () => {
    const tx = loadFixture("create-v2-tx-1.json").result;
    const mint = "9dtmpyqK6gokJLVWrqPnhw6bq1kXGDJsuCoMtWQUpump";
    const activity = slotActivityFromTransaction(tx, mint, 1_000_000_000_000_000n);
    expect(activity.length).toBeGreaterThan(0);
    for (const a of activity) {
      expect(a.slot).toBe(tx.slot);
      expect(a.supplyPct).toBeGreaterThan(0);
      expect(a.supplyPct).toBeLessThanOrEqual(100);
    }
    // the deployer bundled a BuyV2 into the same tx — they should show up as a buyer.
    expect(activity.some((a) => a.wallet === "26oAvbq3jBrg8F7uDw35LMz7URE4W3jbCn3VbuBspynE")).toBe(
      true,
    );
  });

  it("returns nothing for a failed transaction", () => {
    const tx = loadFixture("create-v2-tx-1.json").result;
    const failed = {
      ...tx,
      meta: tx.meta ? { ...tx.meta, err: { InstructionError: [0, "bogus"] } } : null,
    };
    expect(slotActivityFromTransaction(failed, "anything", 1_000_000n)).toEqual([]);
  });
});
