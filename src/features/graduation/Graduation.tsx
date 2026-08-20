import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createDemoProvider } from "../../lib/rpc/demo";
import type { GraduationEntry } from "../../lib/schemas";

const BAR = 22;

export function Graduation() {
  const provider = useMemo(() => createDemoProvider(), []);
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<GraduationEntry[]>([]);

  const { data = [] } = useQuery({
    queryKey: ["graduation", provider.name],
    queryFn: () => provider.getGraduationCandidates(),
    refetchInterval: 5000,
  });

  const queue = () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setPinned((p) => [
      {
        mint: `pinned-${q}`,
        ticker: q.slice(0, 10),
        platform: "PUMP.FUN",
        curveProgressPct: 0,
        mcapUsd: 0,
        vol1hUsd: 0,
        holders: 0,
        pinned: true,
      },
      ...p,
    ]);
    setQuery("");
  };

  const rows = [...pinned, ...data].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.curveProgressPct - a.curveProgressPct,
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && queue()}
          placeholder="queue a ticker or mint to watch..."
          className="flex-1 px-2 py-1 text-sm outline-none"
          style={{
            background: "var(--flurry-panel)",
            border: "1px solid var(--flurry-dim)",
            color: "var(--flurry-green)",
          }}
        />
        <button
          onClick={queue}
          className="px-3 py-1 text-xs"
          style={{
            color: "var(--flurry-bg)",
            background: "var(--flurry-green)",
            border: "none",
            cursor: "pointer",
          }}
        >
          + WATCH
        </button>
      </div>
      <div className="mb-2 text-xs" style={{ color: "var(--flurry-mid)" }}>
        bonding curve progress // GRADUATED ≥ 100% · CLOSE ≥ 90% · pinned entries stay on top
      </div>
      <div style={{ border: "1px solid var(--flurry-dim)" }}>
        <div
          className="grid px-2 py-1 text-xs"
          style={{
            gridTemplateColumns: "110px 100px 1fr 80px 80px 90px",
            color: "var(--flurry-mid)",
            borderBottom: "1px solid var(--flurry-dim)",
          }}
        >
          <span>TOKEN</span>
          <span>PLATFORM</span>
          <span>CURVE</span>
          <span>MCAP</span>
          <span>VOL/1H</span>
          <span>STATUS</span>
        </div>
        {rows.map((g) => {
          const done = g.curveProgressPct >= 100;
          const close = g.curveProgressPct >= 90 && !done;
          const filled = Math.round((Math.min(g.curveProgressPct, 100) / 100) * BAR);
          const color = done
            ? "var(--flurry-green)"
            : close
              ? "var(--flurry-amber)"
              : "var(--flurry-mid)";
          return (
            <div
              key={g.mint}
              className="grid px-2 py-1 text-sm"
              style={{
                gridTemplateColumns: "110px 100px 1fr 80px 80px 90px",
                borderBottom: "1px solid var(--flurry-dim)",
              }}
            >
              <span>
                {g.pinned && <span style={{ color: "var(--flurry-amber)" }}>★ </span>}${g.ticker}
              </span>
              <span style={{ color: "var(--flurry-cyan)" }}>{g.platform}</span>
              <span style={{ color }}>
                {"█".repeat(filled)}
                {"░".repeat(BAR - filled)} {g.curveProgressPct.toFixed(1)}%
              </span>
              <span>${Math.round(g.mcapUsd / 1000)}k</span>
              <span>${Math.round(g.vol1hUsd / 1000)}k</span>
              <span style={{ color }}>{done ? "GRADUATED" : close ? "CLOSE" : "CURVE"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
