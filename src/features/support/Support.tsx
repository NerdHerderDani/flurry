import { useState } from "react";

// Replace before launch. Placeholder is intentionally invalid.
export const DONATION_ADDRESS = "REPLACE_WITH_REAL_SOL_ADDRESS_BEFORE_LAUNCH";

export function Support() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — user can select the text */
    }
  };
  return (
    <div className="max-w-xl">
      <pre className="mb-4 whitespace-pre-wrap text-sm">
        {`this terminal is free. no fees, no token, no telemetry,
no key custody. your keys, your RPC, your machine.

if it saved you from a bundled launch, the tip jar exists:`}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="px-2 py-1 text-xs"
          style={{
            background: "var(--flurry-panel)",
            border: "1px solid var(--flurry-dim)",
            color: "var(--flurry-cyan)",
          }}
        >
          {DONATION_ADDRESS}
        </code>
        <button
          onClick={() => void copy()}
          className="px-3 py-1 text-xs"
          style={{
            color: "var(--flurry-bg)",
            background: copied ? "var(--flurry-cyan)" : "var(--flurry-green)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {copied ? "COPIED" : "COPY SOL ADDR"}
        </button>
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--flurry-mid)" }}>
        source on github · issues and PRs welcome
      </p>
    </div>
  );
}
