import { UERC20_FACTORY_ADDRESS } from "./abi";
import { exponentialBackoffMs } from "../rateLimiter";
import type { RpcCaller } from "../transport";
import type { RpcLog } from "./types";

export type FeedStatus = "LIVE" | "RECONNECTING";

export interface EvmLaunchFeedOptions {
  onLog: (log: RpcLog) => void;
  onStatus: (s: FeedStatus) => void;
  maxWsFailures?: number;
  pollIntervalMs?: number;
}

function wsUrlFromHttp(rpcUrl: string): string {
  const url = new URL(rpcUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/**
 * Subscribes to UERC20Factory's logs via eth_subscribe("logs", ...), the EVM
 * analogue of the Solana provider's logsSubscribe feed — same reconnect/
 * backoff/poll-fallback shape, same rationale (see pumpfun/feed.ts).
 */
export class EvmLaunchFeed {
  private stopped = false;
  private ws: WebSocket | null = null;
  private wsFailures = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPolledBlock: number | null = null;

  constructor(
    private readonly rpcUrl: string,
    private readonly transport: RpcCaller,
    private readonly opts: EvmLaunchFeedOptions,
  ) {}

  start(): void {
    this.connectWs();
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private connectWs(): void {
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrlFromHttp(this.rpcUrl));
    } catch (e) {
      console.warn("[robinhood feed] could not open WebSocket:", e);
      this.onWsFailure();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_subscribe",
          params: ["logs", { address: UERC20_FACTORY_ADDRESS }],
        }),
      );
    };
    ws.onmessage = (ev: MessageEvent) => {
      this.wsFailures = 0;
      this.opts.onStatus("LIVE");
      this.handleWsMessage(String(ev.data));
    };
    ws.onerror = () => {
      /* onclose fires right after; handled there */
    };
    ws.onclose = (ev: CloseEvent) => {
      if (this.stopped) return;
      console.warn(
        `[robinhood feed] WebSocket closed (code=${ev.code}, reason=${ev.reason || "none"})`,
      );
      this.onWsFailure();
    };
  }

  private handleWsMessage(raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as { method?: string; params?: { result?: RpcLog } };
    if (m.method !== "eth_subscription") return;
    const log = m.params?.result;
    if (log) this.opts.onLog(log);
  }

  private onWsFailure(): void {
    this.wsFailures += 1;
    const maxFailures = this.opts.maxWsFailures ?? 4;
    if (this.wsFailures >= maxFailures) {
      console.warn(
        `[robinhood feed] giving up on WebSocket after ${this.wsFailures} failures, polling instead`,
      );
      this.startPolling();
      return;
    }
    this.opts.onStatus("RECONNECTING");
    const delay = exponentialBackoffMs(this.wsFailures - 1);
    console.warn(
      `[robinhood feed] reconnecting in ${delay}ms (attempt ${this.wsFailures}/${maxFailures})`,
    );
    this.reconnectTimer = setTimeout(() => this.connectWs(), delay);
  }

  private startPolling(): void {
    if (this.stopped) return;
    const intervalMs = this.opts.pollIntervalMs ?? 5000;
    const tick = async () => {
      if (this.stopped) return;
      try {
        const latestHex = await this.transport.call<string>("eth_blockNumber", []);
        const latest = parseInt(latestHex, 16);
        const fromBlock = this.lastPolledBlock === null ? latest : this.lastPolledBlock + 1;
        if (fromBlock <= latest) {
          const logs = await this.transport.call<RpcLog[]>("eth_getLogs", [
            {
              address: UERC20_FACTORY_ADDRESS,
              fromBlock: "0x" + fromBlock.toString(16),
              toBlock: "0x" + latest.toString(16),
            },
          ]);
          for (const log of logs) this.opts.onLog(log);
        }
        this.lastPolledBlock = latest;
        this.opts.onStatus("LIVE");
      } catch (e) {
        console.warn("[robinhood feed] poll tick failed:", e);
        this.opts.onStatus("RECONNECTING");
      } finally {
        if (!this.stopped) this.pollTimer = setTimeout(tick, intervalMs);
      }
    };
    void tick();
  }
}
