import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import {
  apiKeyAtom,
  bridgePortAtom,
  chainAtom,
  demoModeAtom,
  modeAtom,
  rpcUrlAtom,
  rugcheckKeyAtom,
  type ConnectionMode,
} from "../../state/atoms";
import type { Chain } from "../../lib/schemas";
import { checkBridge, type HealthResult } from "../../lib/ai/bridge";

const linkStyle = { color: "var(--flurry-cyan)", textDecoration: "underline" };
const BRIDGE_RAW_URL =
  "https://raw.githubusercontent.com/NerdHerderDani/flurry/main/bridge/flurry-bridge.mjs";
const BRIDGE_SETUP_COMMANDS = `curl -O ${BRIDGE_RAW_URL}\nnode flurry-bridge.mjs`;
const BRIDGE_POLL_MS = 5000;

const RPC_COPY: Record<
  Chain,
  { label: string; placeholder: string; example: string; providerName: string; providerUrl: string }
> = {
  solana: {
    label: "SOLANA RPC ENDPOINT",
    placeholder: "https://your-rpc-provider.example/...",
    example: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
    providerName: "helius.dev",
    providerUrl: "https://www.helius.dev",
  },
  robinhood: {
    label: "ROBINHOOD CHAIN RPC ENDPOINT",
    placeholder: "https://robinhood-mainnet.g.alchemy.com/v2/...",
    example: "https://robinhood-mainnet.g.alchemy.com/v2/YOUR_KEY",
    providerName: "alchemy.com",
    providerUrl: "https://www.alchemy.com",
  },
};

export function Config() {
  const [mode, setMode] = useAtom(modeAtom);
  const [apiKey, setApiKey] = useAtom(apiKeyAtom);
  const [chain, setChain] = useAtom(chainAtom);
  const [rpcUrl, setRpcUrl] = useAtom(rpcUrlAtom);
  const [rugcheckKey, setRugcheckKey] = useAtom(rugcheckKeyAtom);
  const [demoMode, setDemoMode] = useAtom(demoModeAtom);
  const [bridgePort, setBridgePort] = useAtom(bridgePortAtom);
  const [bridgeHealth, setBridgeHealth] = useState<HealthResult | null>(null);
  const [bridgeReachable, setBridgeReachable] = useState(false);
  const [copied, setCopied] = useState(false);

  const rpcCopy = RPC_COPY[chain];
  const rpcLooksLikeBareKey = rpcUrl.trim().length > 0 && !rpcUrl.trim().startsWith("https://");

  // Live status, polled every 5s while this tab is visible (brief: DESKTOP BRIDGE mode).
  useEffect(() => {
    if (mode !== "desktop") return;
    let cancelled = false;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      checkBridge(bridgePort)
        .then((health) => {
          if (cancelled) return;
          setBridgeHealth(health);
          setBridgeReachable(true);
        })
        .catch(() => {
          if (cancelled) return;
          setBridgeHealth(null);
          setBridgeReachable(false);
        });
    };
    poll();
    const timer = setInterval(poll, BRIDGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode, bridgePort]);

  const bridgeConnected = bridgeReachable && bridgeHealth?.ok === true;
  const copySetupCommands = () => {
    void navigator.clipboard.writeText(BRIDGE_SETUP_COMMANDS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="max-w-xl">
      <p className="mb-4 text-xs" style={{ color: "var(--flurry-mid)" }}>
        everything runs in your browser. keys are held in memory for this session only — nothing is
        stored, nothing is sent anywhere except the providers you configure.
      </p>
      <div className="mb-4">
        <div className="mb-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          CHAIN
        </div>
        <div className="flex gap-2">
          {(
            [
              ["solana", "SOLANA"],
              ["robinhood", "ROBINHOOD"],
            ] as [Chain, string][]
          ).map(([c, label]) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className="px-3 py-1 text-xs"
              style={{
                color: chain === c ? "var(--flurry-bg)" : "var(--flurry-green)",
                background: chain === c ? "var(--flurry-green)" : "transparent",
                border: "1px solid var(--flurry-dim)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          CONNECTION MODE
        </div>
        <div className="flex gap-2">
          {(
            [
              ["byok", "API KEY (BYOK)"],
              ["desktop", "DESKTOP BRIDGE"],
            ] as [ConnectionMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1 text-xs"
              style={{
                color: mode === m ? "var(--flurry-bg)" : "var(--flurry-green)",
                background: mode === m ? "var(--flurry-green)" : "transparent",
                border: "1px solid var(--flurry-dim)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "desktop" && (
          <div className="mt-2">
            <p className="text-xs" style={{ color: "var(--flurry-mid)" }}>
              dossier calls route to a local agent on your machine — no Anthropic key ever enters
              this page. the bridge prefers the{" "}
              <span style={{ color: "var(--flurry-green)" }}>claude</span> CLI (Pro/Max
              subscription, zero API billing) and falls back to{" "}
              <span style={{ color: "var(--flurry-green)" }}>ANTHROPIC_API_KEY</span> in its own
              shell env if that's not installed.
            </p>
            <p className="mt-1 text-xs">
              BRIDGE:{" "}
              <span
                style={{ color: bridgeConnected ? "var(--flurry-green)" : "var(--flurry-amber)" }}
              >
                {bridgeConnected
                  ? `CONNECTED (${bridgeHealth?.backend})`
                  : bridgeReachable
                    ? "NO BACKEND"
                    : "NOT FOUND"}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--flurry-mid)" }}>
                PORT
              </label>
              <input
                type="number"
                value={bridgePort}
                onChange={(e) => setBridgePort(Number(e.target.value) || 4114)}
                className="w-24 px-2 py-1 text-sm outline-none"
                style={{
                  background: "var(--flurry-panel)",
                  border: "1px solid var(--flurry-dim)",
                  color: "var(--flurry-green)",
                }}
              />
            </div>
            {!bridgeConnected && (
              <div className="mt-2 p-2" style={{ border: "1px dashed var(--flurry-dim)" }}>
                <p className="mb-1 text-xs" style={{ color: "var(--flurry-amber)" }}>
                  {bridgeReachable
                    ? "bridge is running but has no backend — install the claude CLI or set ANTHROPIC_API_KEY in its shell, then restart it."
                    : "not running. two commands, in a terminal on this machine:"}
                </p>
                <pre
                  className="whitespace-pre-wrap p-2 text-xs"
                  style={{ color: "var(--flurry-green)", background: "var(--flurry-bg)" }}
                >
                  {BRIDGE_SETUP_COMMANDS}
                </pre>
                <button
                  onClick={copySetupCommands}
                  className="mt-1 px-2 py-1 text-xs"
                  style={{
                    color: "var(--flurry-green)",
                    background: "transparent",
                    border: "1px solid var(--flurry-dim)",
                    cursor: "pointer",
                  }}
                >
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
            )}
            <p className="mt-2 text-xs" style={{ color: "var(--flurry-mid)" }}>
              works in Chrome and Firefox. Safari blocks the localhost connection from an https page
              outright — use Chrome or Firefox for bridge mode.
            </p>
          </div>
        )}
      </div>
      {mode === "byok" && (
        <div className="mb-4">
          <div className="mb-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
            ANTHROPIC API KEY
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            className="w-full px-2 py-1 text-sm outline-none"
            style={{
              background: "var(--flurry-panel)",
              border: "1px solid var(--flurry-dim)",
              color: "var(--flurry-green)",
            }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
            sent directly from your browser to Anthropic. never stored, never proxied.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
            starts with <span style={{ color: "var(--flurry-green)" }}>sk-ant-</span>. create one at{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              console.anthropic.com
            </a>{" "}
            — pay-per-call billing, no subscription required.
          </p>
        </div>
      )}
      <div className="mb-4">
        <div className="mb-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          {rpcCopy.label}
        </div>
        <input
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          placeholder={rpcCopy.placeholder}
          className="w-full px-2 py-1 text-sm outline-none"
          style={{
            background: "var(--flurry-panel)",
            border: "1px solid var(--flurry-dim)",
            color: "var(--flurry-green)",
          }}
        />
        {rpcLooksLikeBareKey && (
          <p className="mt-1 text-xs" style={{ color: "var(--flurry-amber)" }}>
            that looks like a bare API key — paste the full RPC URL from your provider&apos;s
            dashboard.
          </p>
        )}
        <p className="mt-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          <span style={{ color: "var(--flurry-green)" }}>full speed:</span> paste a free key from{" "}
          <a href={rpcCopy.providerUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            {rpcCopy.providerName}
          </a>{" "}
          — expected shape: <span style={{ color: "var(--flurry-green)" }}>{rpcCopy.example}</span>{" "}
          (or any {chain === "solana" ? "Solana" : "Robinhood Chain"} RPC provider&apos;s full URL).{" "}
          {chain === "robinhood"
            ? "left blank, flurry runs on Robinhood's public endpoint in SLOW MODE — live feed on, forensics on, conservative request budget."
            : "left blank, flurry shows the demo feed: no public Solana endpoint accepts browser traffic (every free one tested blocks it — verified, see DECODING.md), so live Solana data genuinely needs your own free key."}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--flurry-amber)" }}>
          {chain === "solana"
            ? "pump.fun live feed, bundle checks, and graduation tracking read from this endpoint. rug history and 1h volume/holders can't be verified from raw RPC — always shown as unverified."
            : "pools.trade live feed, bundle checks, and deployer history read from this endpoint. rug history, 1h volume/holders, and funding lineage can't be verified from raw RPC — always shown as unverified. pools.trade has no bonding curve, so every token shows GRADUATED at listing."}
        </p>
      </div>
      <div className="mb-4">
        <div className="mb-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          DEMO FEED
        </div>
        <button
          onClick={() => setDemoMode((d) => !d)}
          className="px-3 py-1 text-xs"
          style={{
            color: demoMode ? "var(--flurry-bg)" : "var(--flurry-green)",
            background: demoMode ? "var(--flurry-amber)" : "transparent",
            border: "1px solid var(--flurry-dim)",
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          {demoMode ? "DEMO FEED ON — synthetic data" : "SWITCH TO DEMO FEED"}
        </button>
        <p className="mt-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          synthetic launches for screenshots or offline use. clearly not live data.
        </p>
      </div>
      <div className="mb-4">
        <div className="mb-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          RUGCHECK API KEY{" "}
          <span style={{ color: "var(--flurry-dim)" }}>(OPTIONAL · SOLANA ONLY)</span>
        </div>
        <input
          type="password"
          value={rugcheckKey}
          onChange={(e) => setRugcheckKey(e.target.value)}
          placeholder="leave blank to disable the cross-check"
          autoComplete="off"
          className="w-full px-2 py-1 text-sm outline-none"
          style={{
            background: "var(--flurry-panel)",
            border: "1px solid var(--flurry-dim)",
            color: "var(--flurry-green)",
          }}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--flurry-mid)" }}>
          with a key, expanded Solana rows gain a{" "}
          <span style={{ color: "var(--flurry-cyan)" }}>CROSS-CHECK</span> panel (rugged status, LP
          locks, insider networks, their risk score) attributed to rugcheck.xyz — a second opinion
          that never changes Flurry&apos;s own RISK verdict. without a key, nothing changes. sent
          directly from your browser to api.rugcheck.xyz, held in memory for this session only.
          create the key under the{" "}
          <span style={{ color: "var(--flurry-green)" }}>RugCheck section</span> of your{" "}
          <a
            href="https://fluxrpc.com/docs/rugcheck/getting-started"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            fluxrpc.com
          </a>{" "}
          dashboard — an RPC-product key is rejected. ignored on Robinhood Chain — RugCheck covers
          Solana only.
        </p>
      </div>
    </div>
  );
}
