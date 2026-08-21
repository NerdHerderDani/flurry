import type { ChainProvider } from "./provider";

/**
 * Phase v0.3 — Meteora Dynamic Bonding Curve program. Powers Believe/launchcoin,
 * Bags, and other creator launchpads (verify Jup Studio's current backend before
 * counting it). Curve implementation is open source: github.com/MeteoraAg/dynamic-bonding-curve
 * VERIFY program id against Meteora docs before enabling:
 * historical program id: dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
 */
export const METEORA_DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

export function createMeteoraDbcProvider(_rpcUrl: string): ChainProvider {
  throw new Error("MeteoraDbcProvider is phase v0.3 — track in issue #4");
}
