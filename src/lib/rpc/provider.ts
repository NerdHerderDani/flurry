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
  /**
   * Lazily resolve deploy-slot bundle activity + deployer history for a launch
   * already on screen. Only called on row expand; providers should cache per mint.
   * Absent on providers where the feed already carries full activity (e.g. demo).
   */
  loadForensics?(
    launch: Launch,
  ): Promise<Pick<Launch, "slotActivity" | "deployerPriorLaunches" | "devHoldsPct">>;
  /**
   * Resolve a user-pasted mint address into a live graduation-tracking entry.
   * Absent on providers that can't do real chain lookups (e.g. demo).
   */
  resolveQueuedMint?(mint: string): Promise<GraduationEntry>;
  /** Tears down any live connection (WS feed, polling timers). Call on unmount. */
  dispose?(): void;
}
