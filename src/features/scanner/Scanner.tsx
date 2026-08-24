import { useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useChainProvider } from "../../lib/rpc/useChainProvider";
import { detectBundle } from "../../lib/forensics/bundle";
import { clusterByFunding, linkedWalletCount } from "../../lib/forensics/cluster";
import { scoreRisk, type RiskTier } from "../../lib/forensics/risk";
import { runDossier } from "../../lib/ai/anthropic";
import { BridgeNoBackendError, runDossierViaBridge } from "../../lib/ai/bridge";
import { apiKeyAtom, bridgePortAtom, feedPausedAtom, modeAtom } from "../../state/atoms";
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
  forensicsLoading: boolean;
  forensicsLoaded: boolean;
}

export function Scanner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [paused, setPaused] = useAtom(feedPausedAtom);
  const apiKey = useAtomValue(apiKeyAtom);
  const mode = useAtomValue(modeAtom);
  const bridgePort = useAtomValue(bridgePortAtom);
  const provider = useChainProvider();

  useEffect(() => {
    const unsub = provider.subscribeLaunches((l) => {
      setRows((rs) => {
        if (paused) return rs;
        return [
          {
            ...l,
            open: false,
            dossier: null,
            dossierLoading: false,
            dossierError: null,
            forensicsLoading: false,
            forensicsLoaded: false,
          },
          ...rs,
        ].slice(0, 40);
      });
    });
    return unsub;
  }, [provider, paused]);

  const patch = (mint: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.mint === mint ? { ...r, ...p } : r)));

  const toggle = (r: Row) => {
    const opening = !r.open;
    patch(r.mint, { open: opening });
    if (opening && !r.forensicsLoaded && !r.forensicsLoading && provider.loadForensics) {
      patch(r.mint, { forensicsLoading: true });
      provider
        .loadForensics(r)
        .then((update) =>
          patch(r.mint, { ...update, forensicsLoading: false, forensicsLoaded: true }),
        )
        .catch(() => patch(r.mint, { forensicsLoading: false, forensicsLoaded: true }));
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
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  ${r.ticker} <span style={{ color: "var(--flurry-mid)" }}>· {r.name}</span>
                </span>
                <span>${Math.round(r.mcapUsd / 1000)}k</span>
                <span style={{ color: linked > 5 ? "var(--flurry-amber)" : "var(--flurry-mid)" }}>
                  {linked}
                </span>
                <span style={{ color: riskColor[tier], textShadow: `0 0 8px ${riskColor[tier]}` }}>
                  {tier}
                </span>
              </div>
              {r.open && (
                <div
                  className="px-3 pb-3 pt-1 text-xs"
                  style={{ background: "var(--flurry-panel)" }}
                >
                  <pre className="whitespace-pre-wrap">
                    {`deployer      ${short(r.deployer)}   (${r.deployerPriorLaunches} prior launches, ${r.rugHistoryVerified ? `${r.deployerPriorRugs} rugs` : "rug history: unverified"})
mint          ${short(r.mint)}
bundle check  ${r.forensicsLoading ? "loading..." : bundle.bundled ? `BUNDLED — ${bundle.deploySlotWallets} wallets bought in deploy slot` : "clean deploy slot"}
first block   ${bundle.deploySlotSupplyPct}% of supply acquired${bundle.deploySlotSupplyPct > 30 ? "  ⚠ concentration" : ""}
wallet links  ${linked} wallets share funding lineage${clusters[0] ? `\nfunder        ${short(clusters[0].funder)} (${clusters[0].wallets.length}-wallet cluster)` : ""}
dev holds     ${r.devHoldsPct}% of supply`}
                  </pre>
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
