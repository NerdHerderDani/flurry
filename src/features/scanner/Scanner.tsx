import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { useChainProvider } from "../../lib/rpc/useChainProvider";
import { detectBundle } from "../../lib/forensics/bundle";
import { clusterByFunding, linkedWalletCount } from "../../lib/forensics/cluster";
import { scoreRisk, type RiskTier } from "../../lib/forensics/risk";
import { ScanQueue, scanRow, type ScanState } from "../../lib/forensics/scan";
import { runDossier } from "../../lib/ai/anthropic";
import { BridgeNoBackendError, runDossierViaBridge } from "../../lib/ai/bridge";
import { toEvidenceSection, type RugcheckCrossCheck } from "../../lib/rugcheck/crossCheck";
import { RugcheckPanel } from "./RugcheckPanel";
import {
  apiKeyAtom,
  bridgePortAtom,
  feedPausedAtom,
  modeAtom,
  rpcThrottledAtom,
  rugcheckKeyAtom,
} from "../../state/atoms";
import type { DossierEvidence, Launch } from "../../lib/schemas";

const riskColor: Record<RiskTier, string> = {
  CRITICAL: "var(--flurry-red)",
  HIGH: "var(--flurry-amber)",
  MODERATE: "var(--flurry-cyan)",
  LOW: "var(--flurry-green)",
};

const short = (a: string) => `${a.slice(0, 8)}...${a.slice(-4)}`;

interface Row extends Launch {
  open: boolean;
  dossier: string | null;
  dossierLoading: boolean;
  dossierError: string | null;
  scanState: ScanState;
}

export function Scanner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [paused, setPaused] = useAtom(feedPausedAtom);
  const apiKey = useAtomValue(apiKeyAtom);
  const mode = useAtomValue(modeAtom);
  const bridgePort = useAtomValue(bridgePortAtom);
  const throttled = useAtomValue(rpcThrottledAtom);
  const rugcheckKey = useAtomValue(rugcheckKeyAtom);
  const queryClient = useQueryClient();
  const provider = useChainProvider();

  // Mirrors `rows` for use inside scanRow/ScanQueue callbacks that need the
  // current row synchronously — not via a `useEffect(() => rowsRef.current =
  // rows, [rows])` mirror, which lags a full render+commit behind. enqueue()
  // calls scan() synchronously inside the same setRows updater that adds the
  // row, so a lagging ref would see the row as not-yet-existing and bail out,
  // permanently stranding it at "unscanned" (found live, via the built app,
  // not just unit tests — see the state-machine tests for the parts that
  // *are* covered by them). Written at every mutation site instead.
  const rowsRef = useRef<Row[]>(rows);
  const throttledRef = useRef(throttled);
  useEffect(() => {
    throttledRef.current = throttled;
  }, [throttled]);

  const patch = (mint: string, p: Partial<Row>) =>
    setRows((rs) => {
      const next = rs.map((r) => (r.mint === mint ? { ...r, ...p } : r));
      rowsRef.current = next;
      return next;
    });

  // Background scan queue: fills in real risk verdicts for rows still sitting
  // at "unscanned", one at a time, without ever competing with a
  // user-initiated expand (toggle() below calls scanRow directly, bypassing
  // this queue) or the feed's own RPC traffic for the shared rate limiter.
  const scanQueueRef = useRef<ScanQueue | null>(null);
  useEffect(() => {
    if (!provider.loadForensics) {
      scanQueueRef.current = null;
      return;
    }
    const loadForensics = provider.loadForensics;
    const queue = new ScanQueue({
      scan: (mint) =>
        scanRow(mint, () => rowsRef.current.find((r) => r.mint === mint), patch, loadForensics),
      isThrottled: () => throttledRef.current,
    });
    scanQueueRef.current = queue;
    return () => {
      queue.dispose();
      scanQueueRef.current = null;
    };
  }, [provider]);

  useEffect(() => {
    const unsub = provider.subscribeLaunches((l) => {
      setRows((rs) => {
        if (paused) return rs;
        const nextRows: Row[] = [
          {
            ...l,
            open: false,
            dossier: null,
            dossierLoading: false,
            dossierError: null,
            // No loadForensics means the feed already carries full activity
            // (e.g. demo) — nothing to lazily fetch, so it's scanned already.
            scanState: (provider.loadForensics ? "unscanned" : "scanned") as ScanState,
          },
          ...rs,
        ].slice(0, 40);
        const stillVisible = new Set(nextRows.map((row) => row.mint));
        const evicted = rs.filter((row) => !stillVisible.has(row.mint)).map((row) => row.mint);
        rowsRef.current = nextRows;
        if (evicted.length) scanQueueRef.current?.dropAll(evicted);
        if (provider.loadForensics) scanQueueRef.current?.enqueue(l.mint);
        return nextRows;
      });
    });
    return unsub;
  }, [provider, paused]);

  const toggle = (r: Row) => {
    const opening = !r.open;
    patch(r.mint, { open: opening });
    if (opening && r.scanState === "unscanned" && provider.loadForensics) {
      const loadForensics = provider.loadForensics;
      scanQueueRef.current?.dropAll([r.mint]); // user expand always wins over the background queue
      void scanRow(
        r.mint,
        () => rowsRef.current.find((x) => x.mint === r.mint),
        patch,
        loadForensics,
      );
    }
  };

  const analyze = (r: Row) => {
    const bundle = detectBundle(r.deploySlot, r.slotActivity);
    const clusters = clusterByFunding(r.slotActivity);
    const linked = linkedWalletCount(clusters);
    const { tier } = scoreRisk({
      bundled: bundle.bundled,
      firstBlockSupplyPct: bundle.deploySlotSupplyPct,
      linkedWallets: linked,
      deployerPriorRugs: r.deployerPriorRugs,
      devHoldsPct: r.devHoldsPct,
    });
    return { bundle, clusters, linked, tier };
  };

  const onDossier = async (r: Row) => {
    if (mode === "byok" && !apiKey) {
      patch(r.mint, { dossierError: "Set an Anthropic API key in [F3] CONFIG first." });
      return;
    }
    const { bundle, linked } = analyze(r);
    // Already-fetched cross-check joins the evidence as a source-labeled,
    // numbers-only section. Never fetched here — the dossier uses what the
    // panel already loaded, or nothing.
    const crossCheck =
      r.chain === "solana" && rugcheckKey.trim()
        ? queryClient.getQueryData<RugcheckCrossCheck>(["rugcheck", r.mint])
        : undefined;
    const evidence: DossierEvidence = {
      chain: r.chain,
      ticker: r.ticker,
      platformLabel: r.platformLabel,
      deployer: r.deployer,
      bundled: bundle.bundled,
      bundleWallets: bundle.deploySlotWallets,
      firstBlockSupplyPct: bundle.deploySlotSupplyPct,
      linkedWallets: linked,
      deployerPriorLaunches: r.deployerPriorLaunches,
      deployerPriorRugs: r.deployerPriorRugs,
      devHoldsPct: r.devHoldsPct,
      ...(crossCheck && { rugcheck: toEvidenceSection(crossCheck) }),
    };
    patch(r.mint, { dossierLoading: true, dossierError: null });
    try {
      const text =
        mode === "byok"
          ? await runDossier(evidence, apiKey)
          : await runDossierViaBridge(evidence, bridgePort);
      patch(r.mint, { dossier: text, dossierLoading: false });
    } catch (e) {
      let message: string;
      if (e instanceof BridgeNoBackendError) {
        message = `bridge has no backend configured: ${e.message}`;
      } else if (mode === "desktop" && e instanceof TypeError) {
        message = "bridge not running — see the setup commands in [F3] CONFIG.";
      } else {
        message = e instanceof Error ? e.message : "dossier failed";
      }
      patch(r.mint, { dossierLoading: false, dossierError: message });
    }
  };

  return (
    <div>
      <div
        className="mb-2 flex items-center justify-between text-xs"
        style={{ color: "var(--flurry-mid)" }}
      >
        <span>live launches // all platforms // click a row for forensics</span>
        <button
          onClick={() => setPaused((p) => !p)}
          className="px-3 py-1"
          style={{
            color: paused ? "var(--flurry-amber)" : "var(--flurry-mid)",
            border: "1px solid var(--flurry-dim)",
            cursor: "pointer",
          }}
        >
          {paused ? "▶ RESUME FEED" : "⏸ PAUSE FEED"}
        </button>
      </div>
      <div style={{ border: "1px solid var(--flurry-dim)" }}>
        <div
          className="grid px-2 py-1 text-xs"
          style={{
            gridTemplateColumns: "70px 90px 1fr 90px 60px 80px",
            color: "var(--flurry-mid)",
            borderBottom: "1px solid var(--flurry-dim)",
          }}
        >
          <span>AGE</span>
          <span>PLATFORM</span>
          <span>TOKEN</span>
          <span>MCAP</span>
          <span>LINKS</span>
          <span>RISK</span>
        </div>
        {rows.map((r) => {
          const { bundle, clusters, linked, tier } = analyze(r);
          const ageSec = Math.floor((Date.now() - r.launchedAt) / 1000);
          return (
            <div key={r.mint} style={{ borderBottom: "1px solid var(--flurry-dim)" }}>
              <div
                onClick={() => toggle(r)}
                className="grid cursor-pointer px-2 py-1 text-sm hover:bg-white/5"
                style={{ gridTemplateColumns: "70px 90px 1fr 90px 60px 80px" }}
              >
                <span style={{ color: "var(--flurry-mid)" }}>
                  {ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m`}
                </span>
                <span
                  style={{
                    color: "var(--flurry-cyan)",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: "var(--flurry-mid)" }}>
                    {r.chain === "solana" ? "SOL" : "RHC"}·
                  </span>
                  {r.platformLabel}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  ${r.ticker} <span style={{ color: "var(--flurry-mid)" }}>· {r.name}</span>
                </span>
                <span>${Math.round(r.mcapUsd / 1000)}k</span>
                <span style={{ color: linked > 5 ? "var(--flurry-amber)" : "var(--flurry-mid)" }}>
                  {linked}
                </span>
                {r.scanState === "scanned" ? (
                  <span
                    style={{ color: riskColor[tier], textShadow: `0 0 8px ${riskColor[tier]}` }}
                  >
                    {tier}
                  </span>
                ) : (
                  <span style={{ color: "var(--flurry-dim)" }}>
                    {r.scanState === "scanning" ? "SCAN…" : "SCAN"}
                  </span>
                )}
              </div>
              {r.open && (
                <div
                  className="px-3 pb-3 pt-1 text-xs"
                  style={{ background: "var(--flurry-panel)" }}
                >
                  <pre className="whitespace-pre-wrap">
                    {`deployer      ${short(r.deployer)}   (${r.deployerPriorLaunches} prior launches, ${r.rugHistoryVerified ? `${r.deployerPriorRugs} rugs` : "rug history: unverified"})
mint          ${short(r.mint)}
bundle check  ${r.scanState !== "scanned" ? "loading..." : bundle.bundled ? `BUNDLED — ${bundle.deploySlotWallets} wallets bought in deploy slot` : "clean deploy slot"}
first block   ${bundle.deploySlotSupplyPct}% of supply acquired${bundle.deploySlotSupplyPct > 30 ? "  ⚠ concentration" : ""}
wallet links  ${linked} wallets share funding lineage${clusters[0] ? `\nfunder        ${short(clusters[0].funder)} (${clusters[0].wallets.length}-wallet cluster)` : ""}
dev holds     ${r.devHoldsPct}% of supply`}
                  </pre>
                  {/* Strict enrichment: without a RugCheck key this renders nothing at all. */}
                  {r.chain === "solana" && rugcheckKey.trim().length > 0 && (
                    <RugcheckPanel mint={r.mint} chain={r.chain} expanded={r.open} />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDossier(r);
                    }}
                    disabled={r.dossierLoading}
                    className="mt-2 px-3 py-1 text-xs"
                    style={{
                      color: "var(--flurry-bg)",
                      background: "var(--flurry-cyan)",
                      border: "none",
                      cursor: "pointer",
                      opacity: r.dossierLoading ? 0.5 : 1,
                    }}
                  >
                    {r.dossierLoading
                      ? "ANALYZING..."
                      : r.dossier
                        ? "RERUN AI DOSSIER"
                        : "▸ RUN AI DOSSIER"}
                  </button>
                  {r.dossierError && (
                    <div className="mt-2" style={{ color: "var(--flurry-red)" }}>
                      {r.dossierError}
                    </div>
                  )}
                  {r.dossier && (
                    <pre
                      className="mt-2 whitespace-pre-wrap p-2"
                      style={{
                        color: "var(--flurry-cyan)",
                        border: "1px dashed var(--flurry-dim)",
                      }}
                    >
                      {r.dossier}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
