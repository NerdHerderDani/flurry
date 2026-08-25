import { describe, it, expect, vi } from "vitest";
import { PumpFunLaunchFeed } from "./feed";
import type { RpcCaller } from "../transport";
import type { RpcSignatureInfo, RpcTransaction } from "./types";

function sig(signature: string): RpcSignatureInfo {
  return { signature, slot: 1, err: null };
}

/**
 * Covers the polling fallback path (used whenever an RPC endpoint doesn't
 * support WebSocket subscriptions — see maxWsFailures in feed.ts). We invoke
 * the private startPolling() directly rather than driving four fake WS
 * failures; it's the exact method onWsFailure() calls once it gives up.
 */
function makeTransport(getSignatures: () => RpcSignatureInfo[]): RpcCaller {
  const tx: RpcTransaction = {
    slot: 1,
    meta: { err: null, logMessages: ["Program data: irrelevant-for-this-test"] },
    transaction: { message: { accountKeys: [] } },
  };
  return {
    call: vi.fn(async (method: string) => {
      if (method === "getSignaturesForAddress") return getSignatures() as never;
      if (method === "getTransaction") return tx as never;
      throw new Error(`unexpected RPC method in test: ${method}`);
    }),
  };
}

describe("PumpFunLaunchFeed polling fallback", () => {
  it("does not announce pre-existing history on the first poll tick", async () => {
    const preExisting = [sig("OLD_1"), sig("OLD_2"), sig("OLD_3")];
    const onNotification = vi.fn();
    const feed = new PumpFunLaunchFeed(
      "https://fake-rpc.example",
      makeTransport(() => preExisting),
      { onNotification, onStatus: vi.fn(), pollIntervalMs: 999_999 },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (feed as any).startPolling();
    await vi.waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((feed as any).isFirstPoll).toBe(false);
    });

    expect(onNotification).not.toHaveBeenCalled();
    feed.stop();
  });

  it("still announces a genuinely new signature seen on a later tick", async () => {
    const oldSig = sig("OLD_1");
    let sigs = [oldSig];
    const onNotification = vi.fn();
    const feed = new PumpFunLaunchFeed(
      "https://fake-rpc.example",
      makeTransport(() => sigs),
      { onNotification, onStatus: vi.fn(), pollIntervalMs: 999_999 },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (feed as any).startPolling();
    await vi.waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((feed as any).isFirstPoll).toBe(false);
    });
    expect(onNotification).not.toHaveBeenCalled();

    // A brand-new signature shows up alongside the already-seen one. Firing a
    // second poll tick the same way the internal setTimeout would:
    sigs = [sig("NEW_1"), oldSig];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (feed as any).startPolling();
    await vi.waitFor(() => expect(onNotification).toHaveBeenCalledTimes(1));

    expect(onNotification.mock.calls[0]?.[0]?.signature).toBe("NEW_1");
    feed.stop();
  });
});
