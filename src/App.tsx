import { useState } from "react";
import { useAtomValue } from "jotai";
import { BootLog } from "./components/terminal/BootLog";
import { TabBar, type TabId } from "./components/terminal/TabBar";
import { Scanner } from "./features/scanner/Scanner";
import { Graduation } from "./features/graduation/Graduation";
import { Config } from "./features/config/Config";
import { Support } from "./features/support/Support";
import { apiKeyAtom, feedStatusAtom, modeAtom, rpcThrottledAtom, rpcUrlAtom } from "./state/atoms";

const feedColor: Record<string, string> = {
  LIVE: "var(--flurry-green)",
  RECONNECTING: "var(--flurry-amber)",
  DEMO: "var(--flurry-amber)",
};

export function App() {
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<TabId>("scan");
  const apiKey = useAtomValue(apiKeyAtom);
  const rpcUrl = useAtomValue(rpcUrlAtom);
  const mode = useAtomValue(modeAtom);
  const feedStatus = useAtomValue(feedStatusAtom);
  const throttled = useAtomValue(rpcThrottledAtom);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="scanlines" />
      <div className="vignette" />
      <div className="crt relative z-10 mx-auto max-w-5xl px-4 py-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1
            className="text-4xl leading-none"
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
            <span style={{ color: rpcUrl ? "var(--flurry-green)" : "var(--flurry-amber)" }}>
              {rpcUrl ? "CUSTOM" : "DEMO FEED"}
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
