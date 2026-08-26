import type { FundingCluster } from "@flurry/forensics";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/**
 * A1 — funding-lineage clusters drawn as box-drawing edges between wallet
 * short-addresses. Deliberately text, not SVG: a text graph is legible at
 * 375px, selectable, and reads as terminal output rather than as a chart
 * bolted onto a terminal.
 *
 * Pure and total: no cluster renders as no lines, never a broken diagram.
 */
export function lineageGraph(clusters: readonly FundingCluster[], maxPerCluster = 6): string[] {
  const lines: string[] = [];
  for (const cluster of clusters) {
    lines.push(`${short(cluster.funder)} ┐`);
    const shown = cluster.wallets.slice(0, maxPerCluster);
    shown.forEach((w, i) => {
      const last = i === shown.length - 1 && cluster.wallets.length <= maxPerCluster;
      lines.push(`${" ".repeat(10)}${last ? "└" : "├"}─ ${short(w)}`);
    });
    const hidden = cluster.wallets.length - shown.length;
    if (hidden > 0) lines.push(`${" ".repeat(10)}└─ +${hidden} more`);
  }
  return lines;
}

/**
 * A3 — launches-per-minute sparkline over the session, as block characters.
 * Buckets timestamps into `buckets` windows of `bucketMs` ending at `now`.
 * Returns "" when there is nothing to show, so the header simply omits it
 * rather than rendering a misleading flat line.
 */
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export function sparkline(
  timestamps: readonly number[],
  now: number,
  buckets = 20,
  bucketMs = 60_000,
): string {
  if (timestamps.length === 0) return "";
  const counts = new Array<number>(buckets).fill(0);
  for (const t of timestamps) {
    const age = now - t;
    if (age < 0 || age >= buckets * bucketMs) continue;
    const idx = buckets - 1 - Math.floor(age / bucketMs);
    const cur = counts[idx];
    if (cur !== undefined) counts[idx] = cur + 1;
  }
  const peak = Math.max(...counts);
  if (peak === 0) return "";
  return counts
    .map((c) => {
      if (c === 0) return " ";
      const i = Math.min(BLOCKS.length - 1, Math.floor((c / peak) * (BLOCKS.length - 1)));
      return BLOCKS[i];
    })
    .join("");
}
