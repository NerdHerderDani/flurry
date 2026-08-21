/**
 * Ground truth verified 2026-08-20 against live mainnet transactions (via Helius)
 * cross-checked with the official IDL at github.com/pump-fun/pump-public-docs
 * (idl/pump.json). See ../../../../DECODING.md for the verification trail.
 */

export const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/** Anchor event discriminators (first 8 bytes of the "Program data:" log payload). */
export const CREATE_EVENT_DISCRIMINATOR = [27, 114, 169, 77, 222, 235, 99, 118];
export const TRADE_EVENT_DISCRIMINATOR = [189, 219, 127, 211, 78, 230, 97, 238];

/** Anchor account discriminators (first 8 bytes of raw account data). */
export const BONDING_CURVE_DISCRIMINATOR = [23, 183, 248, 55, 96, 216, 172, 96];
export const GLOBAL_DISCRIMINATOR = [167, 232, 232, 177, 200, 108, 114, 127];

/** PDA seed prefixes, as UTF-8 strings (fed through Buffer.from in the derivers). */
export const BONDING_CURVE_SEED = "bonding-curve";
export const GLOBAL_SEED = "global";

/** Every pump.fun launch mints via Token-2022 with 6 decimals, 1e9 display supply. */
export const PUMP_FUN_MINT_DECIMALS = 6;
