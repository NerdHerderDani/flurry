import { decodeCreateEventFromLogs } from "./decode";
import type { RpcCaller } from "./transport";
import type { RpcSignatureInfo, RpcTransaction } from "./types";

export interface DeployerHistoryResult {
  priorLaunches: number;
  /** True if the signature window was full — there may be more we didn't see. */
  truncated: boolean;
}

/**
 * Brief section D, scoped down from "limit 1000" to a bounded recent window:
 * getSignaturesForAddress has no program filter, so counting pump.fun creates
 * means fetching each candidate tx. 1000 sequential getTransaction calls on a
 * single row expand would blow the rate budget; DECODING.md documents this
 * as a deliberate, disclosed truncation rather than a silent one.
 */
export async function countDeployerPriorLaunches(
  transport: RpcCaller,
  deployer: string,
  inspectLimit = 40,
): Promise<DeployerHistoryResult> {
  const sigs = await transport.call<RpcSignatureInfo[]>("getSignaturesForAddress", [
    deployer,
    { limit: inspectLimit },
  ]);
  let priorLaunches = 0;
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await transport.call<RpcTransaction | null>("getTransaction", [
      s.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    const logs = tx?.meta?.logMessages;
    if (!logs) continue;
    const event = decodeCreateEventFromLogs(logs);
    if (event && event.user === deployer) priorLaunches++;
  }
  return { priorLaunches, truncated: sigs.length >= inspectLimit };
}
