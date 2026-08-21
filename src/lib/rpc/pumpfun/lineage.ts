import type { RpcCaller } from "./transport";
import type { RpcSignatureInfo, RpcTransaction } from "./types";

/**
 * One-hop funding lineage (brief section C): scans a wallet's recent history,
 * newest first, for the most recent inbound SOL transfer and reports whoever's
 * balance dropped by a matching amount in that same transaction. v0.1 scope is
 * exactly one hop — no recursive graph walk.
 */
export async function findFundedBy(
  transport: RpcCaller,
  wallet: string,
  limit = 10,
): Promise<string | null> {
  const sigs = await transport.call<RpcSignatureInfo[]>("getSignaturesForAddress", [
    wallet,
    { limit },
  ]);
  for (const s of sigs) {
    if (s.err) continue;
    const tx = await transport.call<RpcTransaction | null>("getTransaction", [
      s.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    const pre = tx?.meta?.preBalances;
    const post = tx?.meta?.postBalances;
    if (!tx || !pre || !post) continue;
    const keys = tx.transaction.message.accountKeys.map((k) =>
      typeof k === "string" ? k : k.pubkey,
    );
    const walletIdx = keys.indexOf(wallet);
    if (walletIdx < 0) continue;
    const received = (post[walletIdx] ?? 0) - (pre[walletIdx] ?? 0);
    if (received <= 0) continue;
    const funderIdx = keys.findIndex(
      (_, i) => i !== walletIdx && (pre[i] ?? 0) - (post[i] ?? 0) >= received,
    );
    if (funderIdx >= 0) return keys[funderIdx] ?? null;
  }
  return null;
}
