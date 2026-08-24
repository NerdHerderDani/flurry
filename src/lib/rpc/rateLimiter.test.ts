import { describe, expect, it } from "vitest";
import { TokenBucket, exponentialBackoffMs } from "./rateLimiter";

describe("TokenBucket", () => {
  it("lets calls through immediately while tokens remain", async () => {
    const bucket = new TokenBucket(10, 3);
    const start = performance.now();
    await bucket.take();
    await bucket.take();
    await bucket.take();
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("waits for refill once the bucket is empty", async () => {
    const bucket = new TokenBucket(20, 1); // 1 token, refills at 20/sec (~50ms each)
    await bucket.take(); // drains the only token
    const start = performance.now();
    await bucket.take(); // must wait roughly one refill interval
    expect(performance.now() - start).toBeGreaterThanOrEqual(30);
  });
});

describe("exponentialBackoffMs", () => {
  it("doubles per attempt and caps at maxMs", () => {
    expect(exponentialBackoffMs(0, 100)).toBe(100);
    expect(exponentialBackoffMs(1, 100)).toBe(200);
    expect(exponentialBackoffMs(2, 100)).toBe(400);
    expect(exponentialBackoffMs(10, 100, 1000)).toBe(1000);
  });
});
