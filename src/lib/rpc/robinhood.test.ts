import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRobinhoodChainProvider } from "./robinhood";
import type { ChainProvider } from "./provider";
import type { Launch } from "../schemas";

class ThrowingWebSocket {
  constructor() {
    throw new Error("no websocket in tests");
  }
}

const fixture = JSON.parse(
  readFileSync(new URL("./evm/__fixtures__/launch-tx-1.json", import.meta.url), "utf8"),
) as {
  transaction: { from: string; blockNumber: string };
  receipt: { blockNumber: string; status: string; logs: unknown[] };
};

const TOKEN_ADDRESS = "0x0433992Fe236a1821DE40f82c375f1CF1Ac99b30";
const DEPLOYER = fixture.transaction.from;

function jsonResponse(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
}

function fakeLaunch(): Launch {
  return {
    chain: "robinhood",
    mint: TOKEN_ADDRESS,
    ticker: "TEST",
    name: "Test Token",
    program: "POOLS_TRADE",
    platformLabel: "POOLS.TRADE",
    deployer: DEPLOYER,
    deploySlot: parseInt(fixture.receipt.blockNumber, 16),
    launchedAt: Date.now(),
    mcapUsd: 0,
    devHoldsPct: 0,
    deployerPriorLaunches: 0,
    deployerPriorRugs: 0,
    rugHistoryVerified: false,
    slotActivity: [],
  };
}

let providers: ChainProvider[] = [];
function trackedProvider(rpcUrl: string): ChainProvider {
  const p = createRobinhoodChainProvider(rpcUrl);
  providers.push(p);
  return p;
}

describe("createRobinhoodChainProvider orchestration", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", ThrowingWebSocket);
  });

  afterEach(() => {
    for (const p of providers) p.dispose?.();
    providers = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not call the RPC at all until a row is expanded", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    trackedProvider("https://example-rpc.test");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches loadForensics per mint — a second expand makes no new RPC calls", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        callCount++;
        if (url.includes("coingecko"))
          return new Response(JSON.stringify({ ethereum: { usd: 2500 } }));
        const body = JSON.parse(String(init?.body)) as { method: string };
        switch (body.method) {
          case "eth_getLogs":
            return jsonResponse([]);
          case "eth_blockNumber":
            return jsonResponse("0x1");
          default:
            throw new Error(`unexpected method in test: ${body.method}`);
        }
      }),
    );

    const provider = trackedProvider("https://example-rpc.test");
    const launch = fakeLaunch();

    const first = await provider.loadForensics?.(launch);
    const callsAfterFirst = callCount;
    const second = await provider.loadForensics?.(launch);

    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(callCount).toBe(callsAfterFirst);
    expect(second).toEqual(first);
  });

  it("getGraduationCandidates starts empty and returns GRADUATED-at-listing entries once tracked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([])),
    );
    const provider = trackedProvider("https://example-rpc.test");
    expect(await provider.getGraduationCandidates()).toEqual([]);
  });

  it("resolveQueuedMint rejects a non-EVM-shaped address", async () => {
    const provider = trackedProvider("https://example-rpc.test");
    await expect(provider.resolveQueuedMint?.("not-an-address")).rejects.toThrow(
      "not a valid EVM address",
    );
  });

  it("resolveQueuedMint rejects an address with no TokenLaunched event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([])),
    );
    const provider = trackedProvider("https://example-rpc.test");
    await expect(provider.resolveQueuedMint?.(TOKEN_ADDRESS)).rejects.toThrow(/no pools\.trade/);
  });
});
