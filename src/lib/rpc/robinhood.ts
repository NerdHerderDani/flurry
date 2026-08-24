import { encodeEventTopics } from "viem";
import type { ChainProvider } from "./provider";
import { Launch, isValidAddress, type GraduationEntry } from "../schemas";
import { TokenBucket } from "./rateLimiter";
import { RpcTransport } from "./transport";
import {
  DISTRIBUTION_INITIALIZED_EVENT,
  INSTANT_LAUNCH_STRATEGY_ADDRESS,
  POOL_MANAGER_ADDRESS,
  POOL_SWAP_EVENT,
  TOKEN_LAUNCHED_EVENT,
} from "./evm/abi";
import { EvmLaunchFeed, type FeedStatus } from "./evm/feed";
import {
  decodeDistributionInitializedFromLog,
  decodeSwapFromLog,
  decodeTokenCreatedFromLog,
} from "./evm/decode";
import { readErc20NameSymbol } from "./evm/token";
import { fetchDeployBlockActivity, attachFundingLineage } from "./evm/forensics";
import { countDeployerPriorLaunches } from "./evm/deployerHistory";
import {
  buildGraduationEntry,
  computeMcapUsdFromSwap,
  type TrackedTokenMeta,
} from "./evm/graduation";
import { EthUsdPriceCache } from "./evm/price";
import type { RpcLog, RpcTransaction, RpcTransactionReceipt } from "./evm/types";

const MAX_TRACKED_TOKENS = 50;
const RATE_LIMIT_RPS = 8;
const PROGRAM: Launch["program"] = "POOLS_TRADE";
const PLATFORM_LABEL = "POOLS.TRADE";

interface TrackedToken extends TrackedTokenMeta {
  mcapUsd: number;
}

export interface RobinhoodChainProviderCallbacks {
  onStatus?: (status: FeedStatus) => void;
  onThrottle?: (throttled: boolean) => void;
}

export function createRobinhoodChainProvider(
  rpcUrl: string,
  callbacks: RobinhoodChainProviderCallbacks = {},
): ChainProvider {
  const limiter = new TokenBucket(RATE_LIMIT_RPS);
  const transport = new RpcTransport(rpcUrl, limiter, callbacks.onThrottle);
  const priceCache = new EthUsdPriceCache();

  const trackedTokens = new Map<string, TrackedToken>();
  const trackOrder: string[] = [];
  function track(mint: string, meta: TrackedToken): void {
    if (!trackedTokens.has(mint)) trackOrder.push(mint);
    trackedTokens.set(mint, meta);
    while (trackOrder.length > MAX_TRACKED_TOKENS) {
      const oldest = trackOrder.shift();
      if (oldest) trackedTokens.delete(oldest);
    }
  }

  const launchListeners = new Set<(l: Launch) => void>();

  const feed = new EvmLaunchFeed(rpcUrl, transport, {
    onStatus: (s) => callbacks.onStatus?.(s),
    onLog: (log) => {
      void handleFactoryLog(log);
    },
  });

  async function handleFactoryLog(log: RpcLog): Promise<void> {
    const created = decodeTokenCreatedFromLog(log);
    if (!created) return;
    const [tx, receipt] = await Promise.all([
      transport.call<RpcTransaction | null>("eth_getTransactionByHash", [log.transactionHash]),
      transport.call<RpcTransactionReceipt | null>("eth_getTransactionReceipt", [
        log.transactionHash,
      ]),
    ]);
    if (!tx || !receipt || receipt.status !== "0x1") return; // reverted tx: the create didn't happen

    const blockNumber = parseInt(receipt.blockNumber, 16);
    let totalSupply = 0n;
    let mcapUsd = 0;
    const [solUsd] = await Promise.all([priceCache.get()]);
    for (const l of receipt.logs) {
      const dist = decodeDistributionInitializedFromLog(l);
      if (dist && dist.token.toLowerCase() === created.tokenAddress.toLowerCase()) {
        totalSupply = dist.totalSupply;
      }
      if (l.address.toLowerCase() === POOL_MANAGER_ADDRESS) {
        const swap = decodeSwapFromLog(l);
        if (swap && solUsd !== null) mcapUsd = computeMcapUsdFromSwap(swap, totalSupply, solUsd);
      }
    }

    let name = created.description || created.tokenAddress;
    let symbol = created.tokenAddress.slice(0, 8);
    try {
      const read = await readErc20NameSymbol(transport, created.tokenAddress);
      name = read.name;
      symbol = read.symbol;
    } catch {
      /* fall back to the values above — the token still gets a row */
    }

    track(created.tokenAddress, {
      mint: created.tokenAddress,
      ticker: symbol,
      program: PROGRAM,
      platformLabel: PLATFORM_LABEL,
      totalSupply,
      mcapUsd,
    });

    const launch = Launch.parse({
      chain: "robinhood",
      mint: created.tokenAddress,
      ticker: symbol,
      name,
      program: PROGRAM,
      platformLabel: PLATFORM_LABEL,
      deployer: tx.from,
      deploySlot: blockNumber,
      launchedAt: Date.now(),
      mcapUsd,
      devHoldsPct: 0,
      deployerPriorLaunches: 0,
      deployerPriorRugs: 0,
      rugHistoryVerified: false,
      slotActivity: [],
    });
    for (const listener of launchListeners) listener(launch);
  }

  feed.start();

  const forensicsCache = new Map<
    string,
    Promise<Pick<Launch, "slotActivity" | "deployerPriorLaunches" | "devHoldsPct">>
  >();

  return {
    name: "robinhood chain (rpc)",

    subscribeLaunches(onLaunch) {
      launchListeners.add(onLaunch);
      return () => launchListeners.delete(onLaunch);
    },

    async getGraduationCandidates(): Promise<GraduationEntry[]> {
      return [...trackedTokens.values()].map((meta) =>
        buildGraduationEntry(meta, meta.mcapUsd, false),
      );
    },

    async loadForensics(launch) {
      const cached = forensicsCache.get(launch.mint);
      if (cached) return cached;
      const promise = (async () => {
        const totalSupply = trackedTokens.get(launch.mint)?.totalSupply ?? 0n;
        const [rawActivity, deployerHistory] = await Promise.all([
          fetchDeployBlockActivity(transport, launch.mint, launch.deploySlot, totalSupply),
          countDeployerPriorLaunches(transport, launch.deployer),
        ]);
        const slotActivity = attachFundingLineage(rawActivity);
        const devHoldsPct = slotActivity
          .filter((a) => a.wallet.toLowerCase() === launch.deployer.toLowerCase())
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
      if (!isValidAddress("robinhood", mint)) throw new Error("not a valid EVM address");

      const launchedTopics = encodeEventTopics({
        abi: [TOKEN_LAUNCHED_EVENT],
        eventName: "TokenLaunched",
        args: { token: mint as `0x${string}` },
      });
      const distTopics = encodeEventTopics({
        abi: [DISTRIBUTION_INITIALIZED_EVENT],
        eventName: "DistributionInitialized",
        args: { token: mint as `0x${string}` },
      });
      const [launchedLogs, distLogs] = await Promise.all([
        transport.call<RpcLog[]>("eth_getLogs", [
          {
            address: INSTANT_LAUNCH_STRATEGY_ADDRESS,
            topics: launchedTopics,
            fromBlock: "0x0",
            toBlock: "latest",
          },
        ]),
        transport.call<RpcLog[]>("eth_getLogs", [
          {
            address: INSTANT_LAUNCH_STRATEGY_ADDRESS,
            topics: distTopics,
            fromBlock: "0x0",
            toBlock: "latest",
          },
        ]),
      ]);
      const launchedLog = launchedLogs[0];
      if (!launchedLog) throw new Error("no pools.trade TokenLaunched event for this address");

      const poolIdTopic = launchedLog.topics[1];
      let totalSupply = 0n;
      const distLog = distLogs[0];
      if (distLog) {
        const dist = decodeDistributionInitializedFromLog(distLog);
        if (dist) totalSupply = dist.totalSupply;
      }

      const [{ name, symbol }, solUsd] = await Promise.all([
        readErc20NameSymbol(transport, mint),
        priceCache.get(),
      ]);

      let mcapUsd = 0;
      if (poolIdTopic && solUsd !== null) {
        const swapTopics = encodeEventTopics({ abi: [POOL_SWAP_EVENT], eventName: "Swap" });
        const swapLogs = await transport.call<RpcLog[]>("eth_getLogs", [
          {
            address: POOL_MANAGER_ADDRESS,
            topics: [swapTopics[0] ?? null, poolIdTopic],
            fromBlock: "0x0",
            toBlock: "latest",
          },
        ]);
        const lastSwapLog = swapLogs[swapLogs.length - 1];
        const swap = lastSwapLog && decodeSwapFromLog(lastSwapLog);
        if (swap) mcapUsd = computeMcapUsdFromSwap(swap, totalSupply, solUsd);
      }

      const meta: TrackedToken = {
        mint,
        ticker: symbol || name,
        program: PROGRAM,
        platformLabel: PLATFORM_LABEL,
        totalSupply,
        mcapUsd,
      };
      track(mint, meta);
      return buildGraduationEntry(meta, mcapUsd, true);
    },

    dispose() {
      feed.stop();
    },
  };
}
