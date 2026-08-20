import { useEffect, useState } from "react";

const BOOT = [
  "FLURRY 慌 v0.1.0",
  "(c) 2026 — free forever. keys never leave your browser.",
  "",
  "> init renderer .............. OK",
  "> load forensics engine ...... OK",
  "> rpc endpoint ............... DEMO FEED (configure in F3)",
  "> anthropic key .............. NOT SET (required for dossiers)",
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
  return (
    <pre className="mt-6 text-sm" style={{ textShadow: "0 0 6px #5bff8a44" }}>
      {BOOT.slice(0, n).join("\n")}
      <span className="cursor">█</span>
    </pre>
  );
}
