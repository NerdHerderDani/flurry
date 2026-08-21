import { PublicKey } from "@solana/web3.js";
import { BONDING_CURVE_SEED, GLOBAL_SEED, PUMP_FUN_PROGRAM_ID } from "./idl";

const PROGRAM_ID = new PublicKey(PUMP_FUN_PROGRAM_ID);
const enc = (s: string) => new TextEncoder().encode(s);

/** Verified against a live create_v2 tx: seeds ["bonding-curve", mint], pump.fun program. */
export function deriveBondingCurvePda(mint: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [enc(BONDING_CURVE_SEED), new PublicKey(mint).toBytes()],
    PROGRAM_ID,
  );
  return pda.toBase58();
}

/** Verified against a live create_v2 tx: seeds ["global"], pump.fun program. */
export function deriveGlobalPda(): string {
  const [pda] = PublicKey.findProgramAddressSync([enc(GLOBAL_SEED)], PROGRAM_ID);
  return pda.toBase58();
}

export function isValidMintAddress(mint: string): boolean {
  try {
    new PublicKey(mint);
    return true;
  } catch {
    return false;
  }
}
