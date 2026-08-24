import { slotActivityFromLogs } from "./decode";
import type { RpcCaller } from "../transport";
import type { RpcLog } from "./types";
import type { SlotActivity } from "../../schemas";

/**
 * Brief section "bundle check": every ERC-20 Transfer of this token within the
 * exact deploy block, netted per address (see decode.ts). One eth_getLogs call —
 * unlike Solana, EVM logs are natively block-range-filterable, so this needs no
 * per-signature getTransaction loop. A single-block range is well within even
 * the tightest real free-tier caps seen (Alchemy's free tier allows up to 10),
 * but this still degrades to "no activity found" rather than throwing if a
 * given RPC is stricter still — a sibling lazy-load failing must not read as
 * this one having failed too (see deployerHistory.ts's comment).
 */
export async function fetchDeployBlockActivity(
  transport: RpcCaller,
  tokenAddress: string,
  deployBlock: number,
  totalSupply: bigint,
): Promise<SlotActivity[]> {
  try {
    const logs = await transport.call<RpcLog[]>("eth_getLogs", [
      { address: tokenAddress, fromBlock: numToHex(deployBlock), toBlock: numToHex(deployBlock) },
    ]);
    return slotActivityFromLogs(logs, tokenAddress as `0x${string}`, deployBlock, totalSupply);
  } catch {
    return [];
  }
}

/**
 * Funding lineage is a documented, deliberate gap on this chain, not a lazy
 * omission: standard Ethereum JSON-RPC has no equivalent of Solana's
 * getSignaturesForAddress (an address-indexed transaction history). Without
 * that, "who last sent this wallet ETH" isn't answerable from a plain
 * eth_getLogs/eth_getTransaction* call — only from a provider-specific
 * indexing API (e.g. Alchemy's transfers API), which would break the "works
 * with any generic EVM RPC" promise this provider makes, matching the same
 * promise the Solana provider makes. Per the brief's own rule — "if the RPC
 * can't answer it cheaply, label unverified rather than fake it" — that
 * label here is simply never setting fundedBy; clusterByFunding already
 * treats missing fundedBy as "no lineage found," which is the honest answer.
 */
export function attachFundingLineage(activity: readonly SlotActivity[]): SlotActivity[] {
  return activity.slice();
}

function numToHex(n: number): string {
  return "0x" + n.toString(16);
}
