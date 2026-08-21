import { BorshReader, base64ToBytes, discriminatorMatches } from "./borsh";
import {
  BONDING_CURVE_DISCRIMINATOR,
  CREATE_EVENT_DISCRIMINATOR,
  GLOBAL_DISCRIMINATOR,
} from "./idl";
import type { RpcTransaction } from "./types";
import type { SlotActivity } from "../../schemas";

export interface CreateEventData {
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  bondingCurve: string;
  user: string;
  creator: string;
  timestamp: number;
  tokenTotalSupply: bigint;
  isMayhemMode: boolean;
  quoteMint: string;
}

/**
 * Anchor emits program events via a self-CPI logged as base64 "Program data:" —
 * decoding that is simpler and more robust than parsing create_v2's raw instruction
 * args, and it's what carries name/symbol/uri (the mint's on-chain metadata lives in
 * a Token-2022 extension, not a separate Metaplex account, on the current program).
 */
export function decodeCreateEventFromLogs(logs: readonly string[]): CreateEventData | null {
  for (const line of logs) {
    if (!line.startsWith("Program data: ")) continue;
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(line.slice("Program data: ".length));
    } catch {
      continue;
    }
    if (bytes.length < 8) continue;
    const r = new BorshReader(bytes);
    const disc = r.discriminator();
    if (!discriminatorMatches(disc, CREATE_EVENT_DISCRIMINATOR)) continue;
    try {
      const name = r.string();
      const symbol = r.string();
      const uri = r.string();
      const mint = r.pubkey();
      const bondingCurve = r.pubkey();
      const user = r.pubkey();
      const creator = r.pubkey();
      const timestamp = Number(r.i64());
      r.u64(); // virtual_token_reserves
      r.u64(); // virtual_sol_reserves
      r.u64(); // real_token_reserves
      const tokenTotalSupply = r.u64();
      r.pubkey(); // token_program
      const isMayhemMode = r.bool();
      r.bool(); // is_cashback_enabled
      const quoteMint = r.pubkey();
      return {
        name,
        symbol,
        uri,
        mint,
        bondingCurve,
        user,
        creator,
        timestamp,
        tokenTotalSupply,
        isMayhemMode,
        quoteMint,
      };
    } catch {
      return null;
    }
  }
  return null;
}

export interface BondingCurveState {
  virtualTokenReserves: bigint;
  virtualQuoteReserves: bigint;
  realTokenReserves: bigint;
  realQuoteReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: string;
  isMayhemMode: boolean;
  quoteMint: string;
}

/** Decodes the BondingCurve account (`getAccountInfo` base64 data). */
export function decodeBondingCurveAccount(dataBase64: string): BondingCurveState | null {
  const bytes = base64ToBytes(dataBase64);
  if (bytes.length < 8) return null;
  const r = new BorshReader(bytes);
  if (!discriminatorMatches(r.discriminator(), BONDING_CURVE_DISCRIMINATOR)) return null;
  try {
    const virtualTokenReserves = r.u64();
    const virtualQuoteReserves = r.u64();
    const realTokenReserves = r.u64();
    const realQuoteReserves = r.u64();
    const tokenTotalSupply = r.u64();
    const complete = r.bool();
    const creator = r.pubkey();
    const isMayhemMode = r.bool();
    r.bool(); // is_cashback_coin
    const quoteMint = r.pubkey();
    return {
      virtualTokenReserves,
      virtualQuoteReserves,
      realTokenReserves,
      realQuoteReserves,
      tokenTotalSupply,
      complete,
      creator,
      isMayhemMode,
      quoteMint,
    };
  } catch {
    return null;
  }
}

/** Decodes only the one Global field this provider needs: the graduation denominator. */
export function decodeGlobalInitialRealTokenReserves(dataBase64: string): bigint | null {
  const bytes = base64ToBytes(dataBase64);
  if (bytes.length < 8) return null;
  const r = new BorshReader(bytes);
  if (!discriminatorMatches(r.discriminator(), GLOBAL_DISCRIMINATOR)) return null;
  try {
    r.bool(); // initialized
    r.pubkey(); // authority
    r.pubkey(); // fee_recipient
    r.u64(); // initial_virtual_token_reserves
    r.u64(); // initial_virtual_sol_reserves
    return r.u64(); // initial_real_token_reserves
  } catch {
    return null;
  }
}

/**
 * curve completes when real_token_reserves hits 0 (verified against the account
 * state directly — see DECODING.md). Progress is the drawdown from the curve's
 * own starting reserves, so it reads 0% at deploy and 100% exactly at completion.
 */
export function computeCurveProgressPct(
  curve: Pick<BondingCurveState, "realTokenReserves" | "complete">,
  initialRealTokenReserves: bigint,
): number {
  if (curve.complete) return 100;
  if (initialRealTokenReserves <= 0n) return 0;
  const drawn = initialRealTokenReserves - curve.realTokenReserves;
  const pct = Number((drawn * 10000n) / initialRealTokenReserves) / 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Fully-diluted valuation implied by the curve's own virtual reserves (the price
 * a marginal buyer faces right now), converted to USD via the SOL/USD price.
 * Decimals cancel: both reserves are raw base units of the same 6-decimal mint.
 */
export function computeMcapUsd(
  curve: Pick<
    BondingCurveState,
    "virtualQuoteReserves" | "virtualTokenReserves" | "tokenTotalSupply"
  >,
  solUsdPrice: number,
): number {
  const virtualTokenReserves = Number(curve.virtualTokenReserves);
  if (virtualTokenReserves <= 0) return 0;
  const pricePerRawTokenLamports = Number(curve.virtualQuoteReserves) / virtualTokenReserves;
  const fdvLamports = pricePerRawTokenLamports * Number(curve.tokenTotalSupply);
  return (fdvLamports / 1e9) * solUsdPrice;
}

/**
 * Slot activity from token-balance deltas rather than decoding buy/buy_v2/sell_v2/...
 * instruction variants directly — the RPC already parses balance changes, and that
 * signal is invariant across whichever trade instruction the swap actually used.
 */
export function slotActivityFromTransaction(
  tx: Pick<RpcTransaction, "slot" | "meta">,
  mint: string,
  tokenTotalSupply: bigint,
): SlotActivity[] {
  const meta = tx.meta;
  if (!meta || meta.err) return [];
  const pre = new Map<number, bigint>();
  for (const b of meta.preTokenBalances ?? []) {
    if (b.mint === mint) pre.set(b.accountIndex, BigInt(b.uiTokenAmount.amount));
  }
  const out: SlotActivity[] = [];
  for (const b of meta.postTokenBalances ?? []) {
    if (b.mint !== mint || !b.owner) continue;
    const before = pre.get(b.accountIndex) ?? 0n;
    const after = BigInt(b.uiTokenAmount.amount);
    const delta = after - before;
    if (delta <= 0n || tokenTotalSupply <= 0n) continue;
    const supplyPct = Math.min(100, Number((delta * 10000n) / tokenTotalSupply) / 100);
    out.push({ wallet: b.owner, slot: tx.slot, supplyPct });
  }
  return out;
}
