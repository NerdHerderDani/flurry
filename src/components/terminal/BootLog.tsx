import { useEffect, useState } from "react";

const BOOT = [
  "FLURRY 慌 v0.1.0",
  "(c) 2026 — free forever. keys never leave your browser.",
  "",
  "> init renderer .............. OK",
  "> load forensics engine ...... OK",
  "> rpc endpoint ............... NOT SET (RHC: public slow mode · SOL: demo — F3)",
  "> anthropic key .............. NOT SET (required for AI deep reads)",
  "",
  // First-boot tour: three lines in the boot style, no modal, no overlay.
  // Session-fresh by design (no persistence, consistent with the invariants).
  "> zero setup: RHC feed live now · solana needs one free key ([F3])",
  "> tap any row for the receipts, plain english included",
  "> [F4] if this saves you from a rug",
  "",
  "READY. [F1] SCANNER  [F2] GRADUATION  [F3] CONFIG  [F4] SUPPORT",
];

export function BootLog({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= BOOT.length) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), n < 3 ? 220 : 90);
    return () => clearTimeout(t);
  }, [n, onDone]);
  // Skippable by any interaction: a click/tap or any key jumps straight in.
  useEffect(() => {
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onDone]);
  return (
    <pre className="mt-6 text-sm" style={{ textShadow: "0 0 6px #5bff8a44" }}>
      {BOOT.slice(0, n).join("\n")}
      <span className="cursor">█</span>
    </pre>
  );
}
