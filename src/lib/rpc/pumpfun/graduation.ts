import { deriveBondingCurvePda } from "./pda";
import {
  computeCurveProgressPct,
  computeMcapUsd,
  decodeBondingCurveAccount,
  type BondingCurveState,
} from "./decode";
import type { RpcCaller } from "../transport";
import type { RpcAccountInfo, RpcResponseWithContext } from "./types";
import type { GraduationEntry, LaunchProgram } from "../../schemas";

export interface TrackedMintMeta {
  mint: string;
  ticker: string;
  program: LaunchProgram;
  platformLabel: string;
}

/**
 * Batched curve-state fetch (brief section E: getMultipleAccounts, never
 * getProgramAccounts). Mints with no bonding-curve account (graduated off the
 * curve entirely, or not a pump.fun mint) are simply absent from the result.
 */
export async function fetchCurveStates(
  transport: RpcCaller,
  mints: readonly string[],
): Promise<Map<string, BondingCurveState>> {
  if (mints.length === 0) return new Map();
  const pdas = mints.map(deriveBondingCurvePda);
  const res = await transport.call<RpcResponseWithContext<(RpcAccountInfo | null)[]>>(
    "getMultipleAccounts",
    [pdas, { encoding: "base64" }],
  );
  const out = new Map<string, BondingCurveState>();
  res.value.forEach((info, i) => {
    if (!info) return;
    const state = decodeBondingCurveAccount(info.data[0]);
    const mint = mints[i];
    if (state && mint) out.set(mint, state);
  });
  return out;
}

export function buildGraduationEntry(
  meta: TrackedMintMeta,
  curve: BondingCurveState,
  initialRealTokenReserves: bigint,
  solUsdPrice: number | null,
  pinned: boolean,
): GraduationEntry {
  return {
    chain: "solana",
    mint: meta.mint,
    ticker: meta.ticker,
    program: meta.program,
    platformLabel: meta.platformLabel,
    curveProgressPct: computeCurveProgressPct(curve, initialRealTokenReserves),
    mcapUsd: solUsdPrice !== null ? computeMcapUsd(curve, solUsdPrice) : 0,
    vol1hUsd: 0,
    holders: 0,
    volHoldersVerified: false,
    pinned,
  };
}

interface JsonParsedMintAccount {
  data: {
    program: string;
    parsed: {
      type: string;
      info: {
        extensions?: { extension: string; state: Record<string, unknown> }[];
      };
    };
  };
}

/**
 * Reads name/symbol straight from the RPC's own jsonParsed decode of the
 * Token-2022 metadata-pointer extension — no on-chain Metaplex account, and no
 * manual extension-TLV parsing needed, the RPC already did it (verified 2026-08-20).
 */
export async function resolveMintMetadata(
  transport: RpcCaller,
  mint: string,
): Promise<{ name: string; ticker: string } | null> {
  const res = await transport.call<RpcResponseWithContext<JsonParsedMintAccount | null>>(
    "getAccountInfo",
    [mint, { encoding: "jsonParsed" }],
  );
  const info = res.value;
  if (!info || info.data.program !== "spl-token-2022" || info.data.parsed.type !== "mint")
    return null;
  const ext = info.data.parsed.info.extensions?.find((e) => e.extension === "tokenMetadata");
  const name = ext?.state.name;
  const symbol = ext?.state.symbol;
  if (typeof name !== "string" || typeof symbol !== "string") return null;
  return { name, ticker: symbol };
}
