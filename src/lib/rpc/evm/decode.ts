import { decodeEventLog, isAddressEqual, type Address } from "viem";
import {
  DISTRIBUTION_INITIALIZED_EVENT,
  ERC20_TRANSFER_EVENT,
  POOL_SWAP_EVENT,
  TOKEN_CREATED_EVENT,
  TOKEN_LAUNCHED_EVENT,
  UERC20_FACTORY_ADDRESS,
} from "./abi";
import type { RpcLog } from "./types";
import type { SlotActivity } from "../../schemas";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export interface TokenCreatedEvent {
  tokenAddress: Address;
  description: string;
  website: string;
  image: string;
}

/**
 * Decodes UERC20Factory's TokenCreated log. This is the launch signal: it fires
 * exactly once per new pools.trade token, from a single well-known address, so
 * subscribing to logs from UERC20_FACTORY_ADDRESS is sufficient (no topic filter
 * needed — the address is the whole factory's job).
 */
export function decodeTokenCreatedFromLog(
  log: Pick<RpcLog, "address" | "data" | "topics">,
): TokenCreatedEvent | null {
  if (!isAddressEqual(log.address as Address, UERC20_FACTORY_ADDRESS as Address)) return null;
  try {
    const decoded = decodeEventLog({
      abi: [TOKEN_CREATED_EVENT],
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    const metadata = decoded.args.metadata;
    return {
      tokenAddress: decoded.args.tokenAddress,
      description: metadata.description,
      website: metadata.website,
      image: metadata.image,
    };
  } catch {
    return null;
  }
}

export interface DistributionInitializedEvent {
  distributor: Address;
  token: Address;
  totalSupply: bigint;
}

export function decodeDistributionInitializedFromLog(
  log: Pick<RpcLog, "data" | "topics">,
): DistributionInitializedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: [DISTRIBUTION_INITIALIZED_EVENT],
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    return decoded.args;
  } catch {
    return null;
  }
}

export interface TokenLaunchedEvent {
  poolId: `0x${string}`;
  token: Address;
  key: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };
}

export function decodeTokenLaunchedFromLog(
  log: Pick<RpcLog, "data" | "topics">,
): TokenLaunchedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: [TOKEN_LAUNCHED_EVENT],
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    return { poolId: decoded.args.poolId, token: decoded.args.token, key: decoded.args.key };
  } catch {
    return null;
  }
}

export interface SwapEvent {
  sender: Address;
  amount0: bigint;
  amount1: bigint;
}

export function decodeSwapFromLog(log: Pick<RpcLog, "data" | "topics">): SwapEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: [POOL_SWAP_EVENT],
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    return {
      sender: decoded.args.sender,
      amount0: decoded.args.amount0,
      amount1: decoded.args.amount1,
    };
  } catch {
    return null;
  }
}

interface TransferEvent {
  from: Address;
  to: Address;
  value: bigint;
}

function decodeTransferFromLog(log: Pick<RpcLog, "data" | "topics">): TransferEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: [ERC20_TRANSFER_EVENT],
      data: log.data as `0x${string}`,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    return decoded.args;
  } catch {
    return null;
  }
}

/**
 * Deploy-block activity from ERC-20 Transfer conservation, the EVM analogue of
 * the Solana provider's token-balance-delta approach: net every Transfer of
 * this token within the block per address (in minus out). Whoever holds a real
 * net-positive balance at the end is a real holder — infrastructure contracts
 * that only pass tokens through (routers, pools mid-swap) net to zero and drop
 * out on their own, no allowlist of "known infra addresses" required.
 */
export function slotActivityFromLogs(
  logs: readonly Pick<RpcLog, "address" | "data" | "topics">[],
  tokenAddress: Address,
  blockNumber: number,
  totalSupply: bigint,
): SlotActivity[] {
  if (totalSupply <= 0n) return [];
  const net = new Map<string, bigint>();
  for (const log of logs) {
    if (!isAddressEqual(log.address as Address, tokenAddress)) continue;
    const transfer = decodeTransferFromLog(log);
    if (!transfer) continue;
    if (!isAddressEqual(transfer.from, ZERO_ADDRESS)) {
      net.set(transfer.from, (net.get(transfer.from) ?? 0n) - transfer.value);
    }
    if (!isAddressEqual(transfer.to, ZERO_ADDRESS)) {
      net.set(transfer.to, (net.get(transfer.to) ?? 0n) + transfer.value);
    }
  }
  const activity: SlotActivity[] = [];
  for (const [wallet, delta] of net) {
    if (delta <= 0n) continue;
    const supplyPct = Math.min(100, Number((delta * 10000n) / totalSupply) / 100);
    activity.push({ wallet, slot: blockNumber, supplyPct });
  }
  return activity;
}
