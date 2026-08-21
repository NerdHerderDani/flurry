import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPumpFunProvider } from "./pumpfun";
import type { ChainProvider } from "./provider";
import type { Launch } from "../schemas";

/** Never actually opens — forces the feed straight into its reconnect path with no network I/O. */
class ThrowingWebSocket {
  constructor() {
    throw new Error("no websocket in tests");
  }
}

function jsonResponse(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
}

/** getAccountInfo/getMultipleAccounts wrap their payload in {context, value} — verified live. */
function accountInfoResponse(value: unknown): Response {
  return jsonResponse({ context: { slot: 1 }, value });
}

const DEPLOYER = "26oAvbq3jBrg8F7uDw35LMz7URE4W3jbCn3VbuBspynE";
const MINT = "9dtmpyqK6gokJLVWrqPnhw6bq1kXGDJsuCoMtWQUpump";
const CURVE_PDA = "Dan7TVQLS8qS2BBt5z5bm7r9FKf149Xs33XACfUP6UPX";
const GLOBAL_PDA = "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf";
// Real global-account.json fixture's base64 data — initial_real_token_reserves = 793_100_000_000_000n.
const GLOBAL_ACCOUNT_BASE64 =
  "p+joschscn8B07uMqzQc4FKEV/LDgX0yeEQZY9zVX+1YuiTJmd2sAqpKwvjQ3Vy8l+MonBl8tQYqVPPZVrnOblEV+WVnqlyz5gAQ2EfjzwMAAKwj/AYAAAAAeMX7UdECAACAxqR+jQMAXwAAAAAAAAAf6nQ58860xO9Lucx77kChpiYXG2hBX+3tQLeolW+E5wHB4eQAAAAAAAUAAAAAAAAAYIzMHfzpYbQ7d5wZFQWm4tO/RdWk20YYrXbILWF1RTVjg3MADqIssmTTSv9koEte+r+7dN3NBImXsZgVR9fREIOEdCkuZ1qUtDbssKmYiUIyioPdxiM4ApYSZ8XNYRfLjRgaDISfqTem80re0wge+VcAqssMm7PZCaS5FHUnpOutEeak/ClEpPqCUb74FUJuG/soxrZkZndgfGrZ9WamRteqj7Bg2CkbTE1HXa/3Yslr3A2s6zbAEurRLtOpSEFh4ATIfOuY+lzkf4A4Bv0seUXSlSSVmuwA3tl4FPOPeEYf6nQ58860xO9Lucx77kChpiYXG2hBX+3tQLeolW+E5wchXZlAeTaU4RYGbORZuBj9+bugx7QbeD+joSDKQZUyAaKLX9JqtHmmqcxsv2sLI+thiFo3HgEgrKkTvu89E4p46JMUH7GOnxV02BDheOGeMGBOMXWqLkoy38hgByfRBwkBNYRTYlYJT5EoGRJ++k5Ea0MzcheT0Th2+arb89x9C19udQGCIPlCZ3ADI3tNa0U3WbSlxpC1nDXZuxh6CQy9KjOYep67E2eZq1mSWxPl3Iswgd8AXbQnwUePpG/4w0egdOlUPz43otBGInrdy06cd0xEJYxD7fJKqKrh8AIUZlvaTDjNbbdDj1m0CLuew7TKnorR8fJGU8SZtXlsINv5sy3dnuo/ObNyEVxxhHwYRc+lNsaFB04DDkTQId4++eNcTLeA8I7i/uhL7ERqV3gl2mjUOfqKXaOwxc/1D2P0VGsBQ55lEMA9ZfrZMeidBL4Ltw1Rlx9RxBX7NEwH20GfISICI1UWqRcTTGdYjEk4IK4VXulmZVd6wbcY2kfdzyoFDuan4iBou4hkCqV/kJMIxh/vcRoBY/WnVcBwvIYNH2NnIHzs2lvMbLHq8PFtaEBFZrGNVtJIGssxcDJlbpBVHHhElkH4SVjcc6dqhdh1b1XALNrKiboZMnkMNoqxV+ktc8VLlrXJMZQeRupL4uDjESd0T8a3TPtFXv6vi9VxeSztRPwfePlKM9CQnF5rX7AhVwrY262N6P2z0g7RzZnrjk6HcBV+6+tnimVduZs39rEybHZX25DPuKh6vvjHtvLIaYgTAAAAAAAAALnS/wAAAADG+nrzvtutOj1l82qryXQxsbvkwtL24OR8pgIDRS9dYQ==";

function fakeLaunch(): Launch {
  return {
    mint: MINT,
    ticker: "TROLBULL",
    name: "TROLBULL",
    program: "PUMP_FUN",
    platformLabel: "PUMP.FUN",
    deployer: DEPLOYER,
    deploySlot: 12345,
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
  const p = createPumpFunProvider(rpcUrl);
  providers.push(p);
  return p;
}

describe("createPumpFunProvider orchestration", () => {
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
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      callCount++;
      const body = JSON.parse(String(init.body)) as { method: string };
      switch (body.method) {
        case "getSignaturesForAddress":
          return jsonResponse([]); // no deploy-slot activity, no deployer history — fine for caching check
        case "getAccountInfo":
          return accountInfoResponse(null);
        default:
          throw new Error(`unexpected method in test: ${body.method}`);
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = trackedProvider("https://example-rpc.test");
    const launch = fakeLaunch();

    const first = await provider.loadForensics?.(launch);
    const callsAfterFirst = callCount;
    const second = await provider.loadForensics?.(launch);

    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(callCount).toBe(callsAfterFirst); // no new calls on the cached second load
    expect(second).toEqual(first);
  });

  it("resolveQueuedMint rejects an address that isn't a pump.fun curve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { method: string };
        if (body.method === "getAccountInfo") return accountInfoResponse(null); // no mint, no curve
        throw new Error(`unexpected method: ${body.method}`);
      }),
    );
    const provider = trackedProvider("https://example-rpc.test");
    await expect(provider.resolveQueuedMint?.(MINT)).rejects.toThrow();
  });

  it("resolveQueuedMint returns a real, pinned graduation entry when both mint and curve resolve", async () => {
    vi.stubGlobal("fetch", vi.fn(mockAccountInfoRouter));
    const provider = trackedProvider("https://example-rpc.test");
    const entry = await provider.resolveQueuedMint?.(MINT);
    expect(entry?.pinned).toBe(true);
    expect(entry?.ticker).toBe("TROLBULL");
    expect(entry?.volHoldersVerified).toBe(false);
    expect(entry?.curveProgressPct).toBe(0); // fresh curve: real_token_reserves == initial
  });

  it("getGraduationCandidates unwraps getMultipleAccounts' {context, value} response", async () => {
    // Regression test: getMultipleAccounts (like getAccountInfo) wraps its payload in
    // {context, value} — a live smoke test against real mainnet caught this being missed
    // (`TypeError: infos.forEach is not a function`) where a self-consistent mock hadn't.
    vi.stubGlobal("fetch", vi.fn(mockAccountInfoRouter));
    const provider = trackedProvider("https://example-rpc.test");
    await provider.resolveQueuedMint?.(MINT); // populates the tracked-mints map used below

    const candidates = await provider.getGraduationCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.mint).toBe(MINT);
    expect(candidates[0]?.curveProgressPct).toBe(0); // fresh curve: real == initial reserves
  });
});

/** Raw BondingCurve account bytes (disc + fields) matching bonding-curve-account.json. */
function encodeCurveFixtureBase64(): string {
  const buf = Buffer.alloc(115);
  buf.set([23, 183, 248, 55, 96, 216, 172, 96], 0); // discriminator
  let o = 8;
  const writeU64 = (v: bigint) => {
    buf.writeBigUInt64LE(v, o);
    o += 8;
  };
  writeU64(1_073_000_000_000_000n); // virtual_token_reserves
  writeU64(30_000_000_002n); // virtual_quote_reserves
  writeU64(793_100_000_000_000n); // real_token_reserves
  writeU64(2n); // real_quote_reserves
  writeU64(1_000_000_000_000_000n); // token_total_supply
  buf.writeUInt8(0, o++); // complete
  o += 32; // creator (zeroes — unused by this test)
  buf.writeUInt8(0, o++); // is_mayhem_mode
  buf.writeUInt8(0, o++); // is_cashback_coin
  o += 32; // quote_mint
  return buf.toString("base64");
}

/** Shared getAccountInfo/getMultipleAccounts router keyed by the real derived PDAs. */
async function mockAccountInfoRouter(_url: string, init: RequestInit): Promise<Response> {
  const body = JSON.parse(String(init.body)) as { method: string; params: unknown[] };
  if (body.method === "getAccountInfo") {
    const [address, opts] = body.params as [string, { encoding: string }];
    if (opts.encoding === "jsonParsed") {
      return accountInfoResponse({
        data: {
          program: "spl-token-2022",
          parsed: {
            type: "mint",
            info: {
              extensions: [
                { extension: "tokenMetadata", state: { name: "TROLBULL", symbol: "TROLBULL" } },
              ],
            },
          },
        },
      });
    }
    if (address === GLOBAL_PDA)
      return accountInfoResponse({ data: [GLOBAL_ACCOUNT_BASE64, "base64"] });
    if (address === CURVE_PDA)
      return accountInfoResponse({ data: [encodeCurveFixtureBase64(), "base64"] });
    return accountInfoResponse(null);
  }
  if (body.method === "getMultipleAccounts") {
    const [pdas] = body.params as [string[]];
    return accountInfoResponse(
      pdas.map((pda) =>
        pda === CURVE_PDA ? { data: [encodeCurveFixtureBase64(), "base64"] } : null,
      ),
    );
  }
  throw new Error(`unexpected method in test: ${body.method}`);
}
