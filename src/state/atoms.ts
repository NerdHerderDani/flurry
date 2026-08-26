import { atom } from "jotai";
import type { Chain } from "../lib/schemas";
import type { DeepLink } from "../lib/deepLink";

export type ConnectionMode = "byok" | "desktop";

/**
 * SECURITY INVARIANT: these atoms are plain in-memory state.
 * No persistence layer (localStorage/IndexedDB/cookies) may ever be attached
 * to apiKeyAtom. Keys die with the tab. See SECURITY.md.
 */
export const modeAtom = atom<ConnectionMode>("byok");
export const apiKeyAtom = atom<string>("");
export const rpcUrlAtom = atom<string>("");
/** Optional RugCheck/FluxRPC key — same invariant as apiKeyAtom: memory only. */
export const rugcheckKeyAtom = atom<string>("");
export const feedPausedAtom = atom<boolean>(false);
export const bridgePortAtom = atom<number>(4114);
export const chainAtom = atom<Chain>("solana");

/** A2 — CRT INTENSITY. "low" is the pre-existing look and the default. */
export type CrtIntensity = "low" | "med";
export const crtIntensityAtom = atom<CrtIntensity>("low");

/** A4 — synthesized keyclick on new CRITICAL launches. Off by default. */
export const sfxEnabledAtom = atom<boolean>(false);

/**
 * A3 — session density counters. Session-scoped by construction (plain atoms,
 * no persistence), same invariant as the keys.
 */
export const launchTimestampsAtom = atom<number[]>([]);
export const scannedCountAtom = atom<number>(0);
export const criticalCountAtom = atom<number>(0);

export type FeedStatus = "LIVE" | "RECONNECTING" | "DEMO";
export const feedStatusAtom = atom<FeedStatus>("DEMO");
export const rpcThrottledAtom = atom<boolean>(false);

/** Explicit demo-feed toggle (screenshots, offline). No longer the default landing state. */
export const demoModeAtom = atom<boolean>(false);

/** Parsed once from the URL at boot; consumed (reset to none) after resolution. */
export const deepLinkAtom = atom<DeepLink>({ kind: "none" });

/** Where reads actually go right now — drives the header badge and config copy.
 * Solana has no browser-usable public endpoint (see publicRpc.ts), so blank
 * input falls back to public SLOW MODE only where one exists. */
export type RpcSource = "custom" | "public" | "demo";
export const rpcSourceAtom = atom<RpcSource>((get) => {
  if (get(demoModeAtom)) return "demo";
  if (get(rpcUrlAtom).trim()) return "custom";
  return get(chainAtom) === "robinhood" ? "public" : "demo";
});
