import type { Launch } from "../schemas";

export type ScanState = "unscanned" | "scanning" | "scanned";

type ForensicsUpdate = Pick<Launch, "slotActivity" | "deployerPriorLaunches" | "devHoldsPct">;

/**
 * Runs one row's lazy forensics fetch and reports the resulting state
 * transition through `patch`. Guarded to a no-op unless the row is currently
 * "unscanned" — this is what makes it safe to call from both a user-initiated
 * expand and the background queue without double-fetching: whichever gets
 * there first flips the state to "scanning" and the other becomes a no-op.
 *
 * Every provider's loadForensics is designed to degrade honestly on RPC
 * failure (empty arrays / zeroed counts, never a throw — see
 * evm/forensics.ts and pumpfun/forensics.ts), so even a rejection here still
 * lands on "scanned" rather than looping back to "unscanned": there's no
 * different action a retry would take, and a permanently-stuck "SCAN"
 * placeholder is worse than a scanned-but-empty verdict.
 */
export async function scanRow<T extends Launch & { scanState: ScanState }>(
  mint: string,
  getRow: () => T | undefined,
  patch: (mint: string, update: Partial<ForensicsUpdate> & { scanState: ScanState }) => void,
  loadForensics: (launch: Launch) => Promise<ForensicsUpdate>,
): Promise<void> {
  const row = getRow();
  if (!row || row.scanState !== "unscanned") return;
  patch(mint, { scanState: "scanning" });
  try {
    const update = await loadForensics(row);
    patch(mint, { ...update, scanState: "scanned" });
  } catch {
    patch(mint, { scanState: "scanned" });
  }
}

export interface ScanQueueDeps {
  scan: (mint: string) => Promise<void>;
  isThrottled: () => boolean;
}

/**
 * Low-priority background queue that fills in real risk verdicts for rows
 * still sitting at "unscanned". Processes strictly one mint at a time, so it
 * never floods the shared rate limiter ahead of the live feed's own RPC
 * traffic or a user-initiated expand (Scanner.tsx's toggle() calls scanRow
 * directly, bypassing this queue entirely — that direct call is what gives
 * user expands priority, not any special-casing in here). Pauses — stops
 * pulling new work, without dropping what's already queued — for as long as
 * the shared limiter reports throttled.
 */
export class ScanQueue {
  private queue: string[] = [];
  private queued = new Set<string>();
  private inFlight: string | null = null;
  private running = false;
  private disposed = false;

  constructor(
    private readonly deps: ScanQueueDeps,
    private readonly throttledPollMs = 1000,
  ) {}

  /** Lowest priority — appended to the back. No-op if already queued or
   *  already the one mint currently in flight (concurrency here is always 1). */
  enqueue(mint: string): void {
    if (this.disposed || this.queued.has(mint) || this.inFlight === mint) return;
    this.queued.add(mint);
    this.queue.push(mint);
    void this.pump();
  }

  /** Drop mints from the queue without scanning them — used when a row is no
   *  longer visible (evicted by the row cap) or is being handled directly by
   *  a user-initiated expand instead. */
  dropAll(mints: readonly string[]): void {
    if (mints.length === 0) return;
    const drop = new Set(mints);
    for (const m of drop) this.queued.delete(m);
    this.queue = this.queue.filter((m) => !drop.has(m));
  }

  dispose(): void {
    this.disposed = true;
    this.queue = [];
    this.queued.clear();
  }

  get size(): number {
    return this.queue.length;
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.disposed && this.queue.length > 0) {
        if (this.deps.isThrottled()) {
          await sleep(this.throttledPollMs);
          continue;
        }
        const mint = this.queue.shift();
        if (mint === undefined) continue;
        this.queued.delete(mint);
        this.inFlight = mint;
        try {
          await this.deps.scan(mint);
        } catch {
          // A misbehaving scan() must not take the rest of the queue down —
          // scanRow itself already degrades honestly, so this is a last-resort
          // guard, not the expected path.
        } finally {
          this.inFlight = null;
        }
      }
    } finally {
      this.running = false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
