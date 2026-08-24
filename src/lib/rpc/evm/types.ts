/** Minimal shapes read from raw Ethereum JSON-RPC responses — only the fields this provider uses. */

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string; // hex
  transactionHash: string;
  logIndex: string; // hex
  removed?: boolean;
}

export interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  blockNumber: string | null; // hex, null if pending
  input: string;
  value: string; // hex wei
}

export interface RpcTransactionReceipt {
  status: string; // "0x1" success, "0x0" reverted
  blockNumber: string; // hex
  logs: RpcLog[];
}

export interface RpcBlock {
  number: string; // hex
  timestamp: string; // hex, unix seconds
  transactions: string[];
}
