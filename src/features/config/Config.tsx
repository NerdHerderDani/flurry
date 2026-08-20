import { useAtom } from "jotai";
import { apiKeyAtom, modeAtom, rpcUrlAtom, type ConnectionMode } from "../../state/atoms";

export function Config() {
  const [mode, setMode] = useAtom(modeAtom);
  const [apiKey, setApiKey] = useAtom(apiKeyAtom);
  const [rpcUrl, setRpcUrl] = useAtom(rpcUrlAtom);

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
        <p className="mt-1 text-xs" style={{ color: "var(--flurry-amber)" }}>
          live chain reads land with the pump.fun provider (issue #1) — demo feed until then.
        </p>
      </div>
    </div>
  );
}
