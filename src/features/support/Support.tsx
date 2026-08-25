import { useState } from "react";
import { JTX_REFERRAL_URL } from "../../lib/jtx";

// Donation wallet — operator-provided 2026-08-20.
export const DONATION_ADDRESS = "4KRr3d6hm9UJHnZBmhPfvZtUd3cETRScCTvsagtq6CbE";

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
      <div className="mt-6 p-3" style={{ border: "1px solid var(--flurry-dim)" }}>
        <p className="mb-2 text-xs" style={{ color: "var(--flurry-mid)" }}>
          another way to support, at zero cost to you: trade on JTX through this referral link. your
          fees don&apos;t change — JTX pays the dev the referral share (20% of the fees you were
          paying anyway), and the 80% of platform fees committed to JTO buybacks and burns under
          JIP-38 is unaffected.
        </p>
        <a
          href={JTX_REFERRAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-3 py-1 text-xs"
          style={{
            color: "var(--flurry-cyan)",
            border: "1px solid var(--flurry-cyan)",
            textDecoration: "none",
          }}
        >
          TRADE ON JTX ↗
        </a>
        <p className="mt-2 text-xs" style={{ color: "var(--flurry-mid)" }}>
          disclosure: the dev works at Jito Labs, holds JTO, and earns JTX referral fees.
        </p>
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--flurry-mid)" }}>
        source on github · issues and PRs welcome
      </p>
    </div>
  );
}
