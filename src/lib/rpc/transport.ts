import { TokenBucket, exponentialBackoffMs } from "./rateLimiter";

export class RpcError extends Error {}

/** Structural interface so tests can pass a fake transport without an RpcTransport instance. */
export interface RpcCaller {
  call<T>(method: string, params: unknown[], maxRetries?: number): Promise<T>;
}

/**
 * Thin JSON-RPC POST client. All pump.fun provider RPC reads go through one
 * instance of this so the token bucket and throttle status stay centralized.
 */
export class RpcTransport implements RpcCaller {
  constructor(
    private readonly rpcUrl: string,
    private readonly limiter: TokenBucket,
    private readonly onThrottle?: (throttled: boolean) => void,
  ) {}

  async call<T>(method: string, params: unknown[], maxRetries = 4): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.limiter.take();
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (res.status === 429) {
        this.onThrottle?.(true);
        if (attempt >= maxRetries)
          throw new RpcError(`${method}: rate-limited after ${attempt + 1} attempts`);
        await sleep(exponentialBackoffMs(attempt));
        continue;
      }
      this.onThrottle?.(false);
      if (!res.ok) throw new RpcError(`${method}: HTTP ${res.status}`);
      const json = (await res.json()) as { result?: T; error?: { message: string } };
      if (json.error) throw new RpcError(`${method}: ${json.error.message}`);
      return json.result as T;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
