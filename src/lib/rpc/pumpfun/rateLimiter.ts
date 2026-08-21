/**
 * Single token-bucket limiter shared across every RPC call this provider makes
 * (brief: "Rate-limit discipline" — one limiter, ~8rps default, tunable).
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly ratePerSec: number,
    private readonly capacity: number = Math.ceil(ratePerSec),
    now: number = performanceNow(),
  ) {
    this.tokens = capacity;
    this.lastRefill = now;
  }

  private refill(now: number): void {
    const elapsedSec = Math.max(0, now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.ratePerSec);
    this.lastRefill = now;
  }

  /** Resolves once a token is available, waiting if the bucket is empty. */
  async take(): Promise<void> {
    for (;;) {
      const now = performanceNow();
      this.refill(now);
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = ((1 - this.tokens) / this.ratePerSec) * 1000;
      await sleep(Math.max(5, waitMs));
    }
  }
}

function performanceNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exponentialBackoffMs(attempt: number, baseMs = 500, maxMs = 30_000): number {
  return Math.min(maxMs, baseMs * 2 ** attempt);
}
