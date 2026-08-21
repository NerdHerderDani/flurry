import { slotActivityFromTransaction } from "./decode";
import { findFundedBy } from "./lineage";
import type { RpcCaller } from "./transport";
import type { RpcSignatureInfo, RpcTransaction } from "./types";
import type { SlotActivity } from "../../schemas";

/**
 * Brief section B: signatures on the curve account, filtered to the exact
 * deploy slot, decoded via token-balance deltas (see decode.ts) rather than
 * any particular buy-instruction variant.
 */
export async function fetchDeploySlotActivity(
  transport: RpcCaller,
  curvePda: string,
  mint: string,
  deploySlot: number,
  tokenTotalSupply: bigint,
  sigLimit = 50,
): Promise<SlotActivity[]> {
  const sigs = await transport.call<RpcSignatureInfo[]>("getSignaturesForAddress", [
    curvePda,
    { limit: sigLimit },
  ]);
  const inSlot = sigs.filter((s) => s.slot === deploySlot && !s.err);
  const activity: SlotActivity[] = [];
  for (const s of inSlot) {
    const tx = await transport.call<RpcTransaction | null>("getTransaction", [
      s.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx) continue;
    activity.push(...slotActivityFromTransaction(tx, mint, tokenTotalSupply));
  }
  return activity;
}

/**
 * Brief section C: one hop of funding lineage per deploy-slot wallet, capped
 * at 12 wallets with concurrency 3.
 */
export async function attachFundingLineage(
  transport: RpcCaller,
  activity: readonly SlotActivity[],
  opts: { maxWallets?: number; concurrency?: number } = {},
): Promise<SlotActivity[]> {
  const maxWallets = opts.maxWallets ?? 12;
  const concurrency = opts.concurrency ?? 3;
  const distinctWallets = [...new Set(activity.map((a) => a.wallet))].slice(0, maxWallets);
  const fundedByMap = new Map<string, string | null>();

  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= distinctWallets.length) return;
      const wallet = distinctWallets[i];
      if (!wallet) continue;
      fundedByMap.set(wallet, await findFundedBy(transport, wallet));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, distinctWallets.length) }, worker));

  return activity.map((a) => {
    const fundedBy = fundedByMap.get(a.wallet);
    return fundedBy ? { ...a, fundedBy } : a;
  });
}
