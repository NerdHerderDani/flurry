import { useEffect, useState } from "react";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import { parseDeepLink } from "./lib/deepLink";
import { BootLog } from "./components/terminal/BootLog";
import { TabBar, type TabId } from "./components/terminal/TabBar";
import { Scanner } from "./features/scanner/Scanner";
import { Graduation } from "./features/graduation/Graduation";
import { Config } from "./features/config/Config";
import { Support } from "./features/support/Support";
import { DensityBar } from "./components/terminal/DensityBar";
import {
  apiKeyAtom,
  chainAtom,
  crtIntensityAtom,
  deepLinkAtom,
  feedStatusAtom,
  modeAtom,
  rpcSourceAtom,
  rpcThrottledAtom,
} from "./state/atoms";

const feedColor: Record<string, string> = {
  LIVE: "var(--flurry-green)",
  RECONNECTING: "var(--flurry-amber)",
  DEMO: "var(--flurry-amber)",
};

const rpcBadge = {
  custom: { label: "CUSTOM", color: "var(--flurry-green)" },
  public: { label: "PUBLIC (SLOW)", color: "var(--flurry-amber)" },
  demo: { label: "DEMO FEED", color: "var(--flurry-amber)" },
} as const;

export function App() {
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<TabId>("scan");
  const apiKey = useAtomValue(apiKeyAtom);
  const rpcSource = useAtomValue(rpcSourceAtom);
  const mode = useAtomValue(modeAtom);
  const feedStatus = useAtomValue(feedStatusAtom);
  const throttled = useAtomValue(rpcThrottledAtom);
  const [deepLink, setDeepLink] = useAtom(deepLinkAtom);
  const setChain = useSetAtom(chainAtom);
  const crtIntensity = useAtomValue(crtIntensityAtom);
  // One ticking clock for the density bar, so the sparkline's newest bucket
  // and the per-minute count stay honest without each row re-rendering.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // A2 — intensity is a root attribute so the CSS custom properties cascade
  // to the fixed-position scanline/vignette layers too.
  useEffect(() => {
    document.documentElement.dataset["crt"] = crtIntensity;
  }, [crtIntensity]);

  // Deep link: parsed once at boot, validated before any use. A valid token
  // link selects its chain and lands on Graduation, where the mint resolves
  // via the same path as the queue box; garbage shows a visible error below.
  useEffect(() => {
    const dl = parseDeepLink(window.location.search);
    if (dl.kind === "none") return;
    setDeepLink(dl);
    if (dl.kind === "token") {
      setChain(dl.chain);
      setTab("grad");
    }
  }, [setChain, setDeepLink]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="scanlines scanlines-drift" />
      <div className="vignette" />
      <div className="crt relative z-10 mx-auto max-w-5xl px-4 py-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1
            className="display text-4xl leading-none"
            style={{ textShadow: "0 0 12px #5bff8a88, 0 0 40px #5bff8a33" }}
          >
            FLURRY{" "}
            <span style={{ color: "var(--flurry-cyan)", textShadow: "0 0 14px #5be8ff88" }}>
              慌
            </span>{" "}
            TERMINAL
          </h1>
          <div className="text-xs" style={{ color: "var(--flurry-mid)" }}>
            FEED: <span style={{ color: feedColor[feedStatus] }}>{feedStatus}</span>{" "}
            {throttled && <span style={{ color: "var(--flurry-red)" }}>RPC: THROTTLED </span>}
            RPC:{" "}
            <span style={{ color: rpcBadge[rpcSource].color }}>
              {rpcBadge[rpcSource].label}
            </span>{" "}
            KEY:{" "}
            <span style={{ color: apiKey ? "var(--flurry-green)" : "var(--flurry-amber)" }}>
              {apiKey ? "SET" : "NOT SET"}
            </span>{" "}
            MODE:{" "}
            <span style={{ color: "var(--flurry-cyan)" }}>
              {mode === "byok" ? "BYOK" : "DESKTOP"}
            </span>
          </div>
        </div>

        {!booted ? (
          <BootLog onDone={() => setBooted(true)} />
        ) : (
          <>
            <TabBar tab={tab} onTab={setTab} />
            <DensityBar now={now} />
            {deepLink.kind === "error" && (
              <div className="mb-2 text-xs" style={{ color: "var(--flurry-red)" }}>
                shared link error: {deepLink.message}{" "}
                <button
                  onClick={() => setDeepLink({ kind: "none" })}
                  className="px-2"
                  style={{
                    color: "var(--flurry-mid)",
                    background: "transparent",
                    border: "1px solid var(--flurry-dim)",
                    cursor: "pointer",
                  }}
                >
                  DISMISS
                </button>
              </div>
            )}
            {tab === "scan" && <Scanner />}
            {tab === "grad" && <Graduation />}
            {tab === "cfg" && <Config />}
            {tab === "don" && <Support />}
            <div className="mt-6 text-xs" style={{ color: "var(--flurry-dim)" }}>
              flurry · not financial advice, it&apos;s forensics
              <span className="cursor" style={{ color: "var(--flurry-green)" }}>
                █
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
