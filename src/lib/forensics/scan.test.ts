import { describe, expect, it, vi } from "vitest";
import { ScanQueue, scanRow, type ScanState } from "./scan";
import type { Launch } from "../schemas";

const BASE: Launch = {
  chain: "solana",
  mint: "mint-1".padEnd(32, "x"),
  ticker: "TEST",
  name: "Test Token",
  program: "PUMP_FUN",
  platformLabel: "PUMP.FUN",
  deployer: "deployer".padEnd(32, "x"),
  deploySlot: 1,
  launchedAt: 0,
  mcapUsd: 0,
  devHoldsPct: 0,
  deployerPriorLaunches: 0,
  deployerPriorRugs: 0,
  rugHistoryVerified: false,
  slotActivity: [],
};

interface Row extends Launch {
  scanState: ScanState;
}

const row = (scanState: ScanState): Row => ({ ...BASE, scanState });

describe("scanRow", () => {
  it("transitions unscanned -> scanning -> scanned on success", async () => {
    const patches: Array<[string, unknown]> = [];
    const patch = (mint: string, update: unknown) => patches.push([mint, update]);
    let resolveLoad!: (v: {
      slotActivity: never[];
      deployerPriorLaunches: number;
      devHoldsPct: number;
    }) => void;
    const loadForensics = vi.fn(
      () =>
        new Promise<{ slotActivity: never[]; deployerPriorLaunches: number; devHoldsPct: number }>(
          (resolve) => {
            resolveLoad = resolve;
          },
        ),
    );

    const r = row("unscanned");
    const promise = scanRow(r.mint, () => r, patch, loadForensics);

    // Synchronously (before the fetch resolves) it must already show "scanning".
    expect(patches).toEqual([[r.mint, { scanState: "scanning" }]]);
    expect(loadForensics).toHaveBeenCalledTimes(1);

    resolveLoad({ slotActivity: [], deployerPriorLaunches: 2, devHoldsPct: 5 });
    await promise;

    expect(patches).toEqual([
      [r.mint, { scanState: "scanning" }],
      [
        r.mint,
        { slotActivity: [], deployerPriorLaunches: 2, devHoldsPct: 5, scanState: "scanned" },
      ],
    ]);
  });

  it("lands on scanned (not stuck, not unscanned) when loadForensics rejects", async () => {
    const patches: unknown[] = [];
    const patch = (mint: string, update: unknown) => patches.push(update);
    const loadForensics = vi.fn().mockRejectedValue(new Error("rpc exploded"));

    const r = row("unscanned");
    await scanRow(r.mint, () => r, patch, loadForensics);

    expect(patches).toEqual([{ scanState: "scanning" }, { scanState: "scanned" }]);
  });

  it("is a no-op when the row is already scanning", async () => {
    const patch = vi.fn();
    const loadForensics = vi.fn();
    const r = row("scanning");

    await scanRow(r.mint, () => r, patch, loadForensics);

    expect(patch).not.toHaveBeenCalled();
    expect(loadForensics).not.toHaveBeenCalled();
  });

  it("is a no-op when the row is already scanned", async () => {
    const patch = vi.fn();
    const loadForensics = vi.fn();
    const r = row("scanned");

    await scanRow(r.mint, () => r, patch, loadForensics);

    expect(patch).not.toHaveBeenCalled();
    expect(loadForensics).not.toHaveBeenCalled();
  });

  it("is a no-op when the row no longer exists (evicted before the scan ran)", async () => {
    const patch = vi.fn();
    const loadForensics = vi.fn();

    await scanRow("gone", () => undefined, patch, loadForensics);

    expect(patch).not.toHaveBeenCalled();
    expect(loadForensics).not.toHaveBeenCalled();
  });
});

describe("ScanQueue", () => {
  it("processes strictly one mint at a time, in enqueue order", async () => {
    const started: string[] = [];
    const finished: string[] = [];
    const resolvers = new Map<string, () => void>();
    const scan = vi.fn((mint: string) => {
      started.push(mint);
      return new Promise<void>((resolve) => {
        resolvers.set(mint, () => {
          finished.push(mint);
          resolve();
        });
      });
    });
    const queue = new ScanQueue({ scan, isThrottled: () => false });

    queue.enqueue("a");
    queue.enqueue("b");
    await Promise.resolve(); // let the pump loop's microtasks settle

    // "b" must not have started while "a" is still in flight.
    expect(started).toEqual(["a"]);

    resolvers.get("a")!();
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toEqual(["a", "b"]);
    expect(finished).toEqual(["a"]);

    resolvers.get("b")!();
    await Promise.resolve();
    expect(finished).toEqual(["a", "b"]);
  });

  it("dedupes an already-queued mint", () => {
    const scan = vi.fn(() => new Promise<void>(() => {}));
    const queue = new ScanQueue({ scan, isThrottled: () => false });

    queue.enqueue("a");
    queue.enqueue("a");

    expect(scan).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0); // "a" was shifted into the in-flight scan, not left queued
  });

  it("dropAll removes a not-yet-started mint so it's never scanned", async () => {
    const scan = vi.fn(() => new Promise<void>(() => {}));
    const queue = new ScanQueue({ scan, isThrottled: () => false });

    queue.enqueue("a"); // starts immediately, occupies the single in-flight slot
    queue.enqueue("b"); // stays queued behind "a"
    await Promise.resolve();

    queue.dropAll(["b"]);
    expect(queue.size).toBe(0);

    // Even though "a" never resolves, "b" must never be scanned once dropped.
    expect(scan).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenCalledWith("a");
  });

  it("pauses pulling new work while throttled, resumes once clear", async () => {
    vi.useFakeTimers();
    try {
      let throttled = true;
      const scan = vi.fn().mockResolvedValue(undefined);
      const queue = new ScanQueue({ scan, isThrottled: () => throttled }, 50);

      queue.enqueue("a");
      await vi.advanceTimersByTimeAsync(500);
      expect(scan).not.toHaveBeenCalled();

      throttled = false;
      await vi.advanceTimersByTimeAsync(50);
      expect(scan).toHaveBeenCalledWith("a");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops scanning anything once disposed", async () => {
    const scan = vi.fn().mockResolvedValue(undefined);
    const queue = new ScanQueue({ scan, isThrottled: () => false });
    queue.dispose();

    queue.enqueue("a");
    await Promise.resolve();

    expect(scan).not.toHaveBeenCalled();
    expect(queue.size).toBe(0);
  });
});
