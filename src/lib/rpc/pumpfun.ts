import type { ChainProvider } from "./provider";
import { Launch, type GraduationEntry } from "../schemas";
import { PUMP_FUN_PROGRAM_ID } from "./pumpfun/idl";
import { TokenBucket } from "./rateLimiter";
import { RpcTransport } from "./transport";
import { PumpFunLaunchFeed, type FeedStatus } from "./pumpfun/feed";
import {
  decodeBondingCurveAccount,
  decodeCreateEventFromLogs,
  decodeGlobalInitialRealTokenReserves,
} from "./pumpfun/decode";
import { deriveBondingCurvePda, deriveGlobalPda, isValidMintAddress } from "./pumpfun/pda";
import { SolUsdPriceCache } from "./pumpfun/price";
import { attachFundingLineage, fetchDeploySlotActivity } from "./pumpfun/forensics";
import { countDeployerPriorLaunches } from "./pumpfun/deployerHistory";
import {
  buildGraduationEntry,
  fetchCurveStates,
  resolveMintMetadata,
  type TrackedMintMeta,
} from "./pumpfun/graduation";
import type { RpcAccountInfo, RpcResponseWithContext } from "./pumpfun/types";

export { PUMP_FUN_PROGRAM_ID };

/**
 * Verified 2026-08-20 against live mainnet; see DECODING.md. Falls back here
 * only when a mint's real supply wasn't captured at create-time (evicted from
 * the tracked-mint cache before the row was expanded).
 */
const DEFAULT_TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000n;
const MAX_TRACKED_MINTS = 50;
const RATE_LIMIT_RPS = 8;

interface TrackedMint extends TrackedMintMeta {
  tokenTotalSupply: bigint;
}

export interface PumpFunProviderCallbacks {
  onStatus?: (status: FeedStatus) => void;
  onThrottle?: (throttled: boolean) => void;
  /** SLOW MODE budget override (public endpoints); defaults to full speed. */
  rps?: number;
  /** Passed through to the feed — 1 skips WS churn on endpoints known to lack it. */
  maxWsFailures?: number;
}

export function createPumpFunProvider(
  rpcUrl: string,
  callbacks: PumpFunProviderCallbacks = {},
): ChainProvider {
  const limiter = new TokenBucket(callbacks.rps ?? RATE_LIMIT_RPS);
  const transport = new RpcTransport(rpcUrl, limiter, callbacks.onThrottle);
  const priceCache = new SolUsdPriceCache();

  let initialRealTokenReserves: bigint | null = null;
  async function getInitialRealTokenReserves(): Promise<bigint> {
    if (initialRealTokenReserves !== null) return initialRealTokenReserves;
    const res = await transport.call<RpcResponseWithContext<RpcAccountInfo | null>>(
      "getAccountInfo",
      [deriveGlobalPda(), { encoding: "base64" }],
    );
    initialRealTokenReserves =
      (res.value && decodeGlobalInitialRealTokenReserves(res.value.data[0])) ?? 0n;
    return initialRealTokenReserves;
  }

  const trackedMints = new Map<string, TrackedMint>();
  const trackOrder: string[] = [];
  function track(mint: string, meta: TrackedMint): void {
    if (!trackedMints.has(mint)) trackOrder.push(mint);
    trackedMints.set(mint, meta);
    while (trackOrder.length > MAX_TRACKED_MINTS) {
      const oldest = trackOrder.shift();
      if (oldest) trackedMints.delete(oldest);
    }
  }

  const launchListeners = new Set<(l: Launch) => void>();

  // Runs for the life of the provider instance — graduation polling needs to know
  // about launches even when nothing is currently subscribed to the feed.
  const feed = new PumpFunLaunchFeed(rpcUrl, transport, {
    onStatus: (s) => callbacks.onStatus?.(s),
    ...(callbacks.maxWsFailures !== undefined && { maxWsFailures: callbacks.maxWsFailures }),
    onNotification: (n) => {
      if (n.err) return; // failed tx: the whole thing (incl. the create) reverted
      const event = decodeCreateEventFromLogs(n.logs);
      if (!event) return;
      track(event.mint, {
        mint: event.mint,
        ticker: event.symbol,
        program: "PUMP_FUN",
        platformLabel: "PUMP.FUN",
        tokenTotalSupply: event.tokenTotalSupply,
      });
      const launch = Launch.parse({
        mint: event.mint,
        ticker: event.symbol,
        name: event.name,
        program: "PUMP_FUN",
        platformLabel: "PUMP.FUN",
        deployer: event.user,
        deploySlot: n.slot,
        launchedAt: event.timestamp * 1000,
        mcapUsd: 0,
        devHoldsPct: 0,
        deployerPriorLaunches: 0,
        deployerPriorRugs: 0,
        rugHistoryVerified: false,
        slotActivity: [],
      });
      for (const listener of launchListeners) listener(launch);
    },
  });
  feed.start();

  const forensicsCache = new Map<
    string,
    Promise<Pick<Launch, "slotActivity" | "deployerPriorLaunches" | "devHoldsPct">>
  >();

  return {
    name: "pump.fun (rpc)",

    subscribeLaunches(onLaunch) {
      launchListeners.add(onLaunch);
      return () => launchListeners.delete(onLaunch);
    },

    async getGraduationCandidates(): Promise<GraduationEntry[]> {
      const mints = [...trackedMints.keys()];
      if (mints.length === 0) return [];
      const [curves, denom, solUsd] = await Promise.all([
        fetchCurveStates(transport, mints),
        getInitialRealTokenReserves(),
        priceCache.get(),
      ]);
      const entries: GraduationEntry[] = [];
      for (const mint of mints) {
        const curve = curves.get(mint);
        const meta = trackedMints.get(mint);
        if (!curve || !meta) continue;
        entries.push(buildGraduationEntry(meta, curve, denom, solUsd, false));
      }
      return entries.sort((a, b) => b.curveProgressPct - a.curveProgressPct);
    },

    async loadForensics(launch) {
      const cached = forensicsCache.get(launch.mint);
      if (cached) return cached;
      const promise = (async () => {
        const tokenTotalSupply =
          trackedMints.get(launch.mint)?.tokenTotalSupply ?? DEFAULT_TOKEN_TOTAL_SUPPLY;
        const curvePda = deriveBondingCurvePda(launch.mint);
        const [rawActivity, deployerHistory] = await Promise.all([
          fetchDeploySlotActivity(
            transport,
            curvePda,
            launch.mint,
            launch.deploySlot,
            tokenTotalSupply,
          ),
          countDeployerPriorLaunches(transport, launch.deployer),
        ]);
        const slotActivity = await attachFundingLineage(transport, rawActivity);
        const devHoldsPct = slotActivity
          .filter((a) => a.wallet === launch.deployer)
          .reduce((sum, a) => sum + a.supplyPct, 0);
        return {
          slotActivity,
          deployerPriorLaunches: deployerHistory.priorLaunches,
          devHoldsPct: Math.min(100, Math.round(devHoldsPct * 10) / 10),
        };
      })();
      forensicsCache.set(launch.mint, promise);
      return promise;
    },

    async resolveQueuedMint(mint): Promise<GraduationEntry> {
      if (!isValidMintAddress(mint)) throw new Error("not a valid Solana address");
      const [metadata, curveRes, denom, solUsd] = await Promise.all([
        resolveMintMetadata(transport, mint),
        transport.call<RpcResponseWithContext<RpcAccountInfo | null>>("getAccountInfo", [
          deriveBondingCurvePda(mint),
          { encoding: "base64" },
        ]),
        getInitialRealTokenReserves(),
        priceCache.get(),
      ]);
      if (!metadata) throw new Error("not a pump.fun Token-2022 mint");
      const curve = curveRes.value && decodeBondingCurveAccount(curveRes.value.data[0]);
      if (!curve) {
        throw new Error(
          "no bonding-curve account for this mint — not pump.fun, or already migrated off-curve",
        );
      }
      const meta: TrackedMint = {
        mint,
        ticker: metadata.ticker,
        program: "PUMP_FUN",
        platformLabel: "PUMP.FUN",
        tokenTotalSupply: curve.tokenTotalSupply,
      };
      track(mint, meta);
      return buildGraduationEntry(meta, curve, denom, solUsd, true);
    },

    dispose() {
      feed.stop();
    },
  };
}
