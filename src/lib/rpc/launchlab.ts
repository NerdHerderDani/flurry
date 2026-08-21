import type { ChainProvider } from "./provider";

/**
 * Phase v0.2 — Raydium LaunchLab program. Powers LetsBonk.fun and 10+ third-party
 * launchpad skins; one decoder covers all of them. The platform config account on
 * each pool identifies which skin launched it -> platformLabel.
 * VERIFY program id against Raydium docs before enabling:
 * historical program id: LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj
 */
export const LAUNCHLAB_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";

export function createLaunchLabProvider(_rpcUrl: string): ChainProvider {
  throw new Error("LaunchLabProvider is phase v0.2 — track in issue #3");
}
