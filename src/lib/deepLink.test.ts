import { describe, expect, it } from "vitest";
import { parseDeepLink } from "./deepLink";

const SOL_MINT = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL";
const EVM_ADDR = "0x1111111111111111111111111111111111111111";

describe("parseDeepLink", () => {
  it("no params → none (normal landing)", () => {
    expect(parseDeepLink("")).toEqual({ kind: "none" });
    expect(parseDeepLink("?utm_source=x")).toEqual({ kind: "none" });
  });

  it("valid solana link resolves", () => {
    expect(parseDeepLink(`?chain=solana&mint=${SOL_MINT}`)).toEqual({
      kind: "token",
      chain: "solana",
      mint: SOL_MINT,
    });
  });

  it("valid robinhood link resolves with the EVM validator", () => {
    expect(parseDeepLink(`?chain=robinhood&mint=${EVM_ADDR}`)).toEqual({
      kind: "token",
      chain: "robinhood",
      mint: EVM_ADDR,
    });
  });

  it("garbage mint fails to a visible error, not a blank screen", () => {
    const r = parseDeepLink("?chain=solana&mint=<script>alert(1)</script>");
    expect(r.kind).toBe("error");
  });

  it("cross-chain mint shape is rejected per chain", () => {
    expect(parseDeepLink(`?chain=solana&mint=${EVM_ADDR}`).kind).toBe("error");
    expect(parseDeepLink(`?chain=robinhood&mint=${SOL_MINT}`).kind).toBe("error");
  });

  it("unknown chain and missing halves error clearly", () => {
    expect(parseDeepLink("?chain=dogechain&mint=abc").kind).toBe("error");
    expect(parseDeepLink(`?mint=${SOL_MINT}`).kind).toBe("error");
    expect(parseDeepLink("?chain=solana").kind).toBe("error");
  });

  it("keys or config in params are simply ignored, never read", () => {
    const r = parseDeepLink(`?chain=solana&mint=${SOL_MINT}&apiKey=sk-ant-evil&rpc=https://x`);
    expect(r).toEqual({ kind: "token", chain: "solana", mint: SOL_MINT });
  });
});
