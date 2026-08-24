import { afterEach, describe, expect, it, vi } from "vitest";
import { BridgeNoBackendError, checkBridge, runDossierViaBridge } from "./bridge";
import type { DossierEvidence } from "../schemas";

const EVIDENCE: DossierEvidence = {
  chain: "solana",
  ticker: "TROLBULL",
  platformLabel: "PUMP.FUN",
  deployer: "26oAvbq3jBrg8F7uDw35LMz7URE4W3jbCn3VbuBspynE",
  bundled: true,
  bundleWallets: 6,
  firstBlockSupplyPct: 22.5,
  linkedWallets: 3,
  deployerPriorLaunches: 4,
  deployerPriorRugs: 1,
  devHoldsPct: 9.5,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("checkBridge", () => {
  it("parses a healthy response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe("http://localhost:4114/v1/health");
        return jsonResponse(200, { ok: true, backend: "claude-cli", version: "0.1.0" });
      }),
    );
    const result = await checkBridge(4114);
    expect(result).toEqual({ ok: true, backend: "claude-cli", version: "0.1.0" });
  });

  it("throws when the bridge is unreachable (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(checkBridge(4114)).rejects.toThrow();
  });

  it("throws on a malformed health body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { ok: true })),
    );
    await expect(checkBridge(4114)).rejects.toThrow();
  });
});

describe("runDossierViaBridge", () => {
  it("returns the dossier text on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        expect(url).toBe("http://localhost:4114/v1/dossier");
        expect(JSON.parse(String(init.body))).toEqual(EVIDENCE);
        return jsonResponse(200, { dossier: "VERDICT: CLEAR\nCONFIDENCE: LOW\nREAD: fine." });
      }),
    );
    const text = await runDossierViaBridge(EVIDENCE, 4114);
    expect(text).toBe("VERDICT: CLEAR\nCONFIDENCE: LOW\nREAD: fine.");
  });

  // Error kind 1: bridge process isn't running at all.
  it("propagates a network-level error when the bridge isn't running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(runDossierViaBridge(EVIDENCE, 4114)).rejects.toThrow(TypeError);
  });

  // Error kind 2: bridge is running but has no claude-cli/api-key backend configured.
  it("throws BridgeNoBackendError on a 503 with a setup hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(503, { error: "no backend available", hint: "install the claude CLI" }),
      ),
    );
    await expect(runDossierViaBridge(EVIDENCE, 4114)).rejects.toThrow(BridgeNoBackendError);
    await expect(runDossierViaBridge(EVIDENCE, 4114)).rejects.toThrow("install the claude CLI");
  });

  it("throws a generic error on other non-2xx statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    await expect(runDossierViaBridge(EVIDENCE, 4114)).rejects.toThrow(/500/);
  });
});
