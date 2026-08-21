import { useAtom } from "jotai";
import { apiKeyAtom, modeAtom, rpcUrlAtom, type ConnectionMode } from "../../state/atoms";

const linkStyle = { color: "var(--flurry-cyan)", textDecoration: "underline" };

export function Config() {
  const [mode, setMode] = useAtom(modeAtom);
  const [apiKey, setApiKey] = useAtom(apiKeyAtom);
  const [rpcUrl, setRpcUrl] = useAtom(rpcUrlAtom);

  const rpcLooksLikeBareKey = rpcUrl.trim().length > 0 && !rpcUrl.trim().startsWith("https://");

  return (
    <div className="max-w-xl">
      <p className="mb-4 text-xs" style={{ color: "var(--flurry-mid)" }}>
        everything runs in your browser. keys are held in memory for this session only — nothing is
        stored, nothing is sent anywhere except the providers you configure.
      </p>
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
          <p className="mt-2 text-xs" style={{ color: "var(--flurry-amber)" }}>
            desktop bridge: point the terminal at a local agent at localhost so no key ever enters
            the page. tracked in issue #2.
          </p>
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
          SOLANA RPC ENDPOINT
        </div>
        <input
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          placeholder="https://your-rpc-provider.example/..."
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
          expected shape:{" "}
          <span style={{ color: "var(--flurry-green)" }}>
            https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
          </span>{" "}
          (or any Solana RPC provider&apos;s full URL). no key yet? get a free one at{" "}
          <a
            href="https://www.helius.dev"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            helius.dev
          </a>
          .
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--flurry-amber)" }}>
          pump.fun live feed, bundle checks, and graduation tracking read from this endpoint. rug
          history and 1h volume/holders can&apos;t be verified from raw RPC — always shown as
          unverified. leave blank for the demo feed.
        </p>
      </div>
    </div>
  );
}
