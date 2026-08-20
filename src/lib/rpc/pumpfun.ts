import type { ChainProvider } from "./provider";
import type { GraduationEntry, Launch } from "../schemas";

/**
 * Pump.fun bonding-curve program on mainnet.
 * VERIFY against current docs before enabling live reads:
 * historical program id: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 */
export const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/**
 * Real-chain provider. v0.2 scope:
 *  - poll getSignaturesForAddress on the curve program, decode create ixs -> Launch
 *  - reconstruct deploy-slot activity from the launch tx + same-slot txs
 *  - curve completion from bonding curve account state -> GraduationEntry
 * All responses validated through zod schemas before entering app state.
 */
export function createPumpFunProvider(_rpcUrl: string): ChainProvider {
  return {
    name: "pump.fun (rpc)",
    subscribeLaunches(_onLaunch: (l: Launch) => void): () => void {
      throw new Error("PumpFunProvider not implemented yet — track in issue #1");
    },
    getGraduationCandidates(): Promise<GraduationEntry[]> {
      throw new Error("PumpFunProvider not implemented yet — track in issue #1");
    },
  };
}
