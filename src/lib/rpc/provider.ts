import type { GraduationEntry, Launch } from "../schemas";

/**
 * ChainProvider is the seam between the UI and any data source.
 * DemoProvider ships now; PumpFunProvider (real RPC) implements the same
 * contract, so the UI never knows the difference.
 */
export interface ChainProvider {
  readonly name: string;
  /** Subscribe to new launches. Returns an unsubscribe fn. */
  subscribeLaunches(onLaunch: (l: Launch) => void): () => void;
  /** Snapshot of tokens on the bonding curve, nearest graduation first. */
  getGraduationCandidates(): Promise<GraduationEntry[]>;
}
