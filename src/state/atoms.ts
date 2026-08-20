import { atom } from "jotai";

export type ConnectionMode = "byok" | "desktop";

/**
 * SECURITY INVARIANT: these atoms are plain in-memory state.
 * No persistence layer (localStorage/IndexedDB/cookies) may ever be attached
 * to apiKeyAtom. Keys die with the tab. See SECURITY.md.
 */
export const modeAtom = atom<ConnectionMode>("byok");
export const apiKeyAtom = atom<string>("");
export const rpcUrlAtom = atom<string>("");
export const feedPausedAtom = atom<boolean>(false);
