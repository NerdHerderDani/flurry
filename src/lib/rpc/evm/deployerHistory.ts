import { decodeTokenCreatedFromLog } from "./decode";
import { UERC20_FACTORY_ADDRESS } from "./abi";
import type { RpcCaller } from "../transport";
import type { RpcLog, RpcTransaction } from "./types";

export interface DeployerHistoryResult {
  priorLaunches: number;
  /** True if the inspection cap was hit — there may be more we didn't see. */
  truncated: boolean;
}

/**
 * Brief section "deployer history": TokenCreated has no indexed creator field,
 * so counting a deployer's prior launches means fetching each candidate log's
 * transaction to read its `from`. Bounded to a recent block window (~2.8h at
 * 100ms blocks) and a capped number of transaction fetches within it — same
 * disclosed-truncation pattern as Solana's deployerHistory.ts, adapted to a
 * chain that can't do a program-filtered signature list at all.
 *
 * Many real EVM RPCs (Alchemy's free tier included — verified live: it caps
 * eth_getLogs to a 10-block range) reject a window this wide outright. That
 * must not take the rest of loadForensics down with it (it did, via
 * Promise.all, before this was caught here) — so a failure here degrades to
 * "0, truncated" rather than throwing. The deploy-block bundle check has its
 * own, much narrower eth_getLogs call and works fine even on such a provider.
 */
export async function countDeployerPriorLaunches(
  transport: RpcCaller,
  deployer: string,
  blockWindow = 100_000,
  inspectLimit = 40,
): Promise<DeployerHistoryResult> {
  try {
    const latest = await transport.call<string>("eth_blockNumber", []);
    const latestBlock = parseInt(latest, 16);
    const fromBlock = Math.max(0, latestBlock - blockWindow);
    const logs = await transport.call<RpcLog[]>("eth_getLogs", [
      { address: UERC20_FACTORY_ADDRESS, fromBlock: "0x" + fromBlock.toString(16), toBlock: latest },
    ]);
    const recent = logs.slice(-inspectLimit);
    let priorLaunches = 0;
    for (const log of recent) {
      const event = decodeTokenCreatedFromLog(log);
      if (!event) continue;
      const tx = await transport.call<RpcTransaction | null>("eth_getTransactionByHash", [
        log.transactionHash,
      ]);
      if (tx && tx.from.toLowerCase() === deployer.toLowerCase()) priorLaunches++;
    }
    return { priorLaunches, truncated: logs.length > inspectLimit };
  } catch {
    return { priorLaunches: 0, truncated: true };
  }
}
