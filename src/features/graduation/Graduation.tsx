import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { useChainProvider } from "../../lib/rpc/useChainProvider";
import { jtxTokenUrl } from "../../lib/jtx";
import { Term } from "../../components/terminal/Term";
import { deepLinkAtom } from "../../state/atoms";
import type { GraduationEntry } from "../../lib/schemas";

const BAR = 22;
const PINNED_REFRESH_MS = 10_000;

export function Graduation() {
  const provider = useChainProvider();
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<GraduationEntry[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useAtom(deepLinkAtom);

  // A shared ?chain&mint link resolves through the exact same path as the
  // queue box: real chain lookup, pinned on top. Errors reuse the queue error line.
  useEffect(() => {
    if (deepLink.kind !== "token") return;
    const resolve = provider.resolveQueuedMint;
    if (!resolve) {
      // Demo provider can't look up real mints — say so instead of hanging.
      setDeepLink({ kind: "none" });
      setQueueError(
        "shared link: resolving a real mint needs a live RPC — paste a free key in [F3] CONFIG, then re-open the link.",
      );
      return;
    }
    const { mint } = deepLink;
    setDeepLink({ kind: "none" });
    resolve(mint)
      .then((entry) => setPinned((p) => (p.some((x) => x.mint === entry.mint) ? p : [entry, ...p])))
      .catch((e: unknown) =>
        setQueueError(
          `shared link: ${e instanceof Error ? e.message : "failed to resolve the mint"}`,
        ),
      );
  }, [deepLink, provider, setDeepLink]);

  const { data = [] } = useQuery({
    queryKey: ["graduation", provider.name],
    queryFn: () => provider.getGraduationCandidates(),
    refetchInterval: 5000,
  });

  const pinnedRef = useRef(pinned);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  // Brief section E: queued mints get the same real curve-state polling as feed tokens.
  useEffect(() => {
    const resolve = provider.resolveQueuedMint;
    if (!resolve) return;
    const t = setInterval(() => {
      for (const row of pinnedRef.current) {
        void resolve(row.mint)
          .then((fresh) =>
            setPinned((rows) => rows.map((r) => (r.mint === fresh.mint ? fresh : r))),
          )
          .catch(() => void 0);
      }
    }, PINNED_REFRESH_MS);
    return () => clearInterval(t);
  }, [provider]);

  const queue = () => {
    const q = query.trim();
    if (!q) return;
    setQueueError(null);
    if (provider.resolveQueuedMint) {
      provider
        .resolveQueuedMint(q)
        .then((entry) => setPinned((p) => [entry, ...p]))
        .catch((e: unknown) =>
          setQueueError(e instanceof Error ? e.message : "failed to resolve mint"),
        );
    } else {
      setPinned((p) => [
        {
          chain: "solana",
          mint: `pinned-${q.toUpperCase()}`,
          ticker: q.slice(0, 10).toUpperCase(),
          program: "PUMP_FUN",
          platformLabel: "PUMP.FUN",
          curveProgressPct: 0,
          mcapUsd: 0,
          vol1hUsd: 0,
          holders: 0,
          volHoldersVerified: true,
          pinned: true,
        },
        ...p,
      ]);
    }
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
          placeholder="queue a mint address to watch..."
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
      {queueError && (
        <div className="mb-2 text-xs" style={{ color: "var(--flurry-red)" }}>
          {queueError}
        </div>
      )}
      <div className="mb-2 text-xs" style={{ color: "var(--flurry-mid)" }}>
        <Term term="bonding curve">bonding curve</Term> progress //{" "}
        <Term term="graduation">GRADUATED</Term> ≥ 100% · CLOSE ≥ 90% · pinned entries stay on top
      </div>
      <div style={{ border: "1px solid var(--flurry-dim)" }}>
        <div
          className="grid grid-cols-[110px_100px_1fr_80px_80px_90px] px-2 py-1 text-xs max-sm:hidden"
          style={{
            color: "var(--flurry-mid)",
            borderBottom: "1px solid var(--flurry-dim)",
          }}
        >
          <span>TOKEN</span>
          <span>PLATFORM</span>
          <span>
            <Term term="bonding curve">CURVE</Term>
          </span>
          <span>
            <Term term="mcap">MCAP</Term>
          </span>
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
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 px-2 py-3 text-sm sm:grid-cols-[110px_100px_1fr_80px_80px_90px] sm:py-1"
              style={{
                borderBottom: "1px solid var(--flurry-dim)",
              }}
            >
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {g.pinned && <span style={{ color: "var(--flurry-amber)" }}>★ </span>}
                <span style={{ color: "var(--flurry-mid)" }}>
                  {g.chain === "solana" ? "SOL" : "RHC"}·
                </span>
                ${g.ticker}
              </span>
              <span
                style={{
                  color: "var(--flurry-cyan)",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {g.platformLabel}
              </span>
              <span className="max-sm:hidden" style={{ color }}>
                {"█".repeat(filled)}
                {"░".repeat(BAR - filled)} {g.curveProgressPct.toFixed(1)}%
              </span>
              <span className="max-sm:hidden">${Math.round(g.mcapUsd / 1000)}k</span>
              <span
                className="max-sm:hidden"
                style={{ color: g.volHoldersVerified ? undefined : "var(--flurry-mid)" }}
              >
                {g.volHoldersVerified ? `$${Math.round(g.vol1hUsd / 1000)}k` : "unverified"}
              </span>
              <span style={{ color }}>
                {done ? "GRADUATED" : close ? "CLOSE" : "CURVE"}
                <span className="sm:hidden"> {g.curveProgressPct.toFixed(0)}%</span>
                {/* JTX is Solana-only spot trading — no link for RHC rows. */}
                {done && g.chain === "solana" && (
                  <a
                    href={jtxTokenUrl(g.mint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs"
                    style={{ color: "var(--flurry-cyan)", textDecoration: "underline" }}
                    title="opens this token's market on JTX (referral link — see SUPPORT tab)"
                  >
                    TRADE ON JTX ↗
                  </a>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
