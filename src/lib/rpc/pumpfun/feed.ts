import { PUMP_FUN_PROGRAM_ID } from "./idl";
import { exponentialBackoffMs } from "./rateLimiter";
import type { RpcCaller } from "./transport";
import type { RpcSignatureInfo, RpcTransaction } from "./types";

export interface LogsNotification {
  signature: string;
  slot: number;
  err: unknown;
  logs: string[];
}

export type FeedStatus = "LIVE" | "RECONNECTING";

export interface LaunchFeedOptions {
  onNotification: (n: LogsNotification) => void;
  onStatus: (s: FeedStatus) => void;
  /** After this many consecutive WS failures, fall back to polling permanently. */
  maxWsFailures?: number;
  pollIntervalMs?: number;
  /** Bounds work per poll tick — the fallback path costs one getTransaction per candidate signature. */
  pollBatchSize?: number;
}

/** Parses rather than regex-replaces so a stray leading space or odd casing can't leave the scheme un-swapped. */
function wsUrlFromHttp(rpcUrl: string): string {
  const url = new URL(rpcUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/**
 * Subscribes to every log mentioning the pump.fun program via a hand-rolled
 * logsSubscribe client (commitment: confirmed), with exponential-backoff
 * reconnects. Falls back to polling getSignaturesForAddress if the endpoint
 * never accepts a WS connection — same output, worse latency, per the brief.
 */
export class PumpFunLaunchFeed {
  private stopped = false;
  private ws: WebSocket | null = null;
  private wsFailures = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private seenSignatures = new Set<string>();
  private seenOrder: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly rpcUrl: string,
    private readonly transport: RpcCaller,
    private readonly opts: LaunchFeedOptions,
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
      console.warn("[pumpfun feed] could not open WebSocket:", e);
      this.onWsFailure();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "logsSubscribe",
          params: [{ mentions: [PUMP_FUN_PROGRAM_ID] }, { commitment: "confirmed" }],
        }),
      );
    };
    ws.onmessage = (ev: MessageEvent) => {
      this.wsFailures = 0;
      this.opts.onStatus("LIVE");
      this.handleWsMessage(String(ev.data));
    };
    ws.onerror = () => {
      /* onclose fires right after in browsers/undici; handled there */
    };
    ws.onclose = (ev: CloseEvent) => {
      if (this.stopped) return;
      console.warn(
        `[pumpfun feed] WebSocket closed (code=${ev.code}, reason=${ev.reason || "none"})`,
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
    const m = msg as {
      method?: string;
      params?: {
        result?: {
          context?: { slot: number };
          value?: { signature: string; err: unknown; logs: string[] };
        };
      };
    };
    if (m.method !== "logsNotification") return;
    const value = m.params?.result?.value;
    const slot = m.params?.result?.context?.slot;
    if (!value || slot === undefined) return;
    this.opts.onNotification({
      signature: value.signature,
      slot,
      err: value.err,
      logs: value.logs,
    });
  }

  private onWsFailure(): void {
    this.wsFailures += 1;
    const maxFailures = this.opts.maxWsFailures ?? 4;
    if (this.wsFailures >= maxFailures) {
      console.warn(
        `[pumpfun feed] giving up on WebSocket after ${this.wsFailures} failures, polling instead`,
      );
      this.startPolling();
      return;
    }
    this.opts.onStatus("RECONNECTING");
    const delay = exponentialBackoffMs(this.wsFailures - 1);
    console.warn(
      `[pumpfun feed] reconnecting in ${delay}ms (attempt ${this.wsFailures}/${maxFailures})`,
    );
    this.reconnectTimer = setTimeout(() => this.connectWs(), delay);
  }

  private startPolling(): void {
    if (this.stopped) return;
    const intervalMs = this.opts.pollIntervalMs ?? 5000;
    const batchSize = this.opts.pollBatchSize ?? 20;
    const tick = async () => {
      if (this.stopped) return;
      try {
        const sigs = await this.transport.call<RpcSignatureInfo[]>("getSignaturesForAddress", [
          PUMP_FUN_PROGRAM_ID,
          { limit: batchSize },
        ]);
        const fresh = sigs.filter((s) => !this.seenSignatures.has(s.signature));
        for (const s of fresh) {
          this.seenSignatures.add(s.signature);
          this.seenOrder.push(s.signature);
        }
        // Bound memory for long-running sessions — only recent signatures matter for dedup.
        while (this.seenOrder.length > 500) {
          const oldest = this.seenOrder.shift();
          if (oldest) this.seenSignatures.delete(oldest);
        }
        // Oldest first so notifications arrive in chain order.
        for (const s of fresh.reverse()) {
          if (s.err) continue;
          const tx = await this.transport.call<RpcTransaction | null>("getTransaction", [
            s.signature,
            { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
          ]);
          const logs = tx?.meta?.logMessages;
          if (tx && logs)
            this.opts.onNotification({
              signature: s.signature,
              slot: tx.slot,
              err: tx.meta?.err,
              logs,
            });
        }
        this.opts.onStatus("LIVE");
      } catch (e) {
        console.warn("[pumpfun feed] poll tick failed:", e);
        this.opts.onStatus("RECONNECTING");
      } finally {
        if (!this.stopped) this.pollTimer = setTimeout(tick, intervalMs);
      }
    };
    void tick();
  }
}
