import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  decodeDistributionInitializedFromLog,
  decodeSwapFromLog,
  decodeTokenCreatedFromLog,
  decodeTokenLaunchedFromLog,
  slotActivityFromLogs,
} from "./decode";
import { computeMcapUsdFromSwap } from "./graduation";
import { POOL_MANAGER_ADDRESS, UERC20_FACTORY_ADDRESS } from "./abi";
import type { RpcLog, RpcTransactionReceipt } from "./types";

const fixturesDir = new URL("./__fixtures__/", import.meta.url);
function loadFixture(name: string): {
  transaction: { from: string; blockNumber: string };
  receipt: RpcTransactionReceipt;
} {
  return JSON.parse(readFileSync(new URL(name, fixturesDir), "utf8"));
}

const FIXTURE_FILES = Array.from({ length: 7 }, (_, i) => `launch-tx-${i + 1}.json`);

describe("decodeTokenCreatedFromLog", () => {
  it.each(FIXTURE_FILES)("decodes the TokenCreated log in %s", (file) => {
    const fixture = loadFixture(file);
    const log = fixture.receipt.logs.find(
      (l) => l.address.toLowerCase() === UERC20_FACTORY_ADDRESS,
    );
    expect(log).toBeDefined();
    const event = decodeTokenCreatedFromLog(log as RpcLog);
    expect(event).not.toBeNull();
    expect(event?.tokenAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("returns null for a log from a different address", () => {
    const fixture = loadFixture("launch-tx-1.json");
    const other = fixture.receipt.logs.find(
      (l) => l.address.toLowerCase() !== UERC20_FACTORY_ADDRESS,
    );
    expect(other).toBeDefined();
    expect(decodeTokenCreatedFromLog(other as RpcLog)).toBeNull();
  });

  it("decodes the exact known fixture values", () => {
    const fixture = loadFixture("launch-tx-1.json");
    const log = fixture.receipt.logs.find(
      (l) => l.address.toLowerCase() === UERC20_FACTORY_ADDRESS,
    );
    const event = decodeTokenCreatedFromLog(log as RpcLog);
    expect(event?.tokenAddress.toLowerCase()).toBe("0x0433992fe236a1821de40f82c375f1cf1ac99b30");
    expect(event?.description).toBe("Brucina Springsteen");
  });
});

describe("decodeDistributionInitializedFromLog", () => {
  it("finds and decodes DistributionInitialized in every fixture", () => {
    for (const file of FIXTURE_FILES) {
      const fixture = loadFixture(file);
      const decoded = fixture.receipt.logs
        .map((l) => decodeDistributionInitializedFromLog(l))
        .find(Boolean);
      expect(decoded, `${file} should have a DistributionInitialized log`).toBeTruthy();
      expect(decoded?.totalSupply).toBeGreaterThan(0n);
    }
  });
});

describe("decodeTokenLaunchedFromLog", () => {
  it("decodes the pool key with native ETH as currency0", () => {
    const fixture = loadFixture("launch-tx-1.json");
    const decoded = fixture.receipt.logs.map((l) => decodeTokenLaunchedFromLog(l)).find(Boolean);
    expect(decoded).toBeTruthy();
    expect(decoded?.key.currency0.toLowerCase()).toBe("0x0000000000000000000000000000000000000000");
    expect(decoded?.key.currency1.toLowerCase()).toBe("0x0433992fe236a1821de40f82c375f1cf1ac99b30");
  });
});

describe("decodeSwapFromLog", () => {
  it("decodes the bundled creator buy matching the real msg.value", () => {
    const fixture = loadFixture("launch-tx-1.json");
    const swapLogs = fixture.receipt.logs.filter(
      (l) => l.address.toLowerCase() === POOL_MANAGER_ADDRESS,
    );
    const swap = swapLogs.map((l) => decodeSwapFromLog(l)).find(Boolean);
    expect(swap).toBeTruthy();
    expect(swap?.amount0).toBe(-49000000000000000n);
    expect(swap?.amount1).toBeGreaterThan(0n);
  });
});

describe("computeMcapUsdFromSwap", () => {
  it("computes a sane FDV from the real bundled buy", () => {
    const swap = {
      sender: "0x0" as `0x${string}`,
      amount0: -49000000000000000n,
      amount1: 19120395508637372338910994n,
    };
    const totalSupply = 1_000_000_000n * 10n ** 18n; // 1B tokens, 18 decimals — typical pools.trade default
    const mcap = computeMcapUsdFromSwap(swap, totalSupply, 2500);
    // price per token ~= 0.049 / 19.12 ETH; FDV = price * 1e9 tokens; * $2500/ETH
    expect(mcap).toBeGreaterThan(1000);
    expect(mcap).toBeLessThan(1_000_000);
  });

  it("is zero when the swap has no token amount", () => {
    const swap = { sender: "0x0" as `0x${string}`, amount0: -1n, amount1: 0n };
    expect(computeMcapUsdFromSwap(swap, 1_000_000n, 2500)).toBe(0);
  });

  it("is zero when total supply is zero", () => {
    const swap = { sender: "0x0" as `0x${string}`, amount0: -1n, amount1: 1n };
    expect(computeMcapUsdFromSwap(swap, 0n, 2500)).toBe(0);
  });
});

describe("slotActivityFromLogs", () => {
  it("derives net-positive buyers from Transfer conservation, ignoring pass-through infra", () => {
    const fixture = loadFixture("launch-tx-1.json");
    const tokenAddress = fixture.receipt.logs
      .map((l) => decodeTokenCreatedFromLog(l))
      .find(Boolean)?.tokenAddress;
    expect(tokenAddress).toBeTruthy();
    const blockNumber = parseInt(fixture.receipt.blockNumber, 16);
    const totalSupply = fixture.receipt.logs
      .map((l) => decodeDistributionInitializedFromLog(l))
      .find(Boolean)?.totalSupply;
    expect(totalSupply).toBeTruthy();

    const activity = slotActivityFromLogs(
      fixture.receipt.logs,
      tokenAddress as `0x${string}`,
      blockNumber,
      totalSupply as bigint,
    );
    expect(activity.length).toBeGreaterThan(0);
    for (const a of activity) {
      expect(a.slot).toBe(blockNumber);
      // A net-positive delta can still round to a 0.00 display pct for dust
      // amounts (e.g. a tiny referral/fee split) — the filter guarantees > 0
      // raw units, not a non-zero displayed percentage.
      expect(a.supplyPct).toBeGreaterThanOrEqual(0);
      expect(a.supplyPct).toBeLessThanOrEqual(100);
    }
    expect(activity.some((a) => a.supplyPct > 0)).toBe(true);
  });

  it("returns nothing when total supply is zero (guards divide-by-zero)", () => {
    expect(slotActivityFromLogs([], "0x0433992Fe236a1821DE40f82c375f1CF1Ac99b30", 1, 0n)).toEqual(
      [],
    );
  });
});
