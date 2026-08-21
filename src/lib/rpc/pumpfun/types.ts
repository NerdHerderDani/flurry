/** Minimal shapes read from raw Solana JSON-RPC responses — only the fields this provider uses. */

export interface RpcTokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

export interface RpcTransactionMeta {
  err: unknown;
  preTokenBalances?: RpcTokenBalance[];
  postTokenBalances?: RpcTokenBalance[];
  preBalances?: number[];
  postBalances?: number[];
  logMessages?: string[];
}

export interface RpcTransaction {
  slot: number;
  blockTime?: number | null;
  meta: RpcTransactionMeta | null;
  transaction: {
    message: {
      accountKeys: (string | { pubkey: string })[];
    };
  };
}

export interface RpcSignatureInfo {
  signature: string;
  slot: number;
  err: unknown;
  blockTime?: number | null;
}

export interface RpcAccountInfo {
  data: [string, string];
  lamports: number;
  owner: string;
}

/** getAccountInfo / getMultipleAccounts wrap their payload in {context, value} — verified live. */
export interface RpcResponseWithContext<T> {
  context: { slot: number };
  value: T;
}
