import { z } from "zod";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const JUP_PRICE_URL = `https://lite-api.jup.ag/price/v3?ids=${WSOL_MINT}`;
const CACHE_TTL_MS = 30_000;

const PriceResponse = z.record(z.string(), z.object({ usdPrice: z.number().positive() }));

/**
 * One keyless, no-auth SOL/USD read (Jupiter's public price API) — the only
 * non-RPC network call this provider makes. Needed because raw Solana RPC has
 * no price oracle, so a SOL-denominated bonding-curve valuation can't become a
 * USD market cap without it. Documented in SECURITY.md's data-flow section.
 */
export class SolUsdPriceCache {
  private cached: { price: number; at: number } | null = null;

  async get(): Promise<number | null> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < CACHE_TTL_MS) return this.cached.price;
    try {
      const res = await fetch(JUP_PRICE_URL);
      if (!res.ok) return this.cached?.price ?? null;
      const parsed = PriceResponse.parse(await res.json());
      const price = parsed[WSOL_MINT]?.usdPrice;
      if (price === undefined) return this.cached?.price ?? null;
      this.cached = { price, at: now };
      return price;
    } catch {
      return this.cached?.price ?? null;
    }
  }
}
