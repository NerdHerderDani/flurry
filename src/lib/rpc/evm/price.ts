import { z } from "zod";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
const CACHE_TTL_MS = 30_000;

const PriceResponse = z.object({ ethereum: z.object({ usd: z.number().positive() }) });

/**
 * One keyless, no-auth ETH/USD read (CoinGecko's public API) — same pattern
 * and same rationale as the Solana provider's Jupiter SOL/USD read: raw EVM
 * RPC has no price oracle. Documented in SECURITY.md's data-flow section.
 */
export class EthUsdPriceCache {
  private cached: { price: number; at: number } | null = null;

  async get(): Promise<number | null> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < CACHE_TTL_MS) return this.cached.price;
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) return this.cached?.price ?? null;
      const parsed = PriceResponse.parse(await res.json());
      this.cached = { price: parsed.ethereum.usd, at: now };
      return this.cached.price;
    } catch {
      return this.cached?.price ?? null;
    }
  }
}
