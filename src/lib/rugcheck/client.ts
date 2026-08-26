import { TokenBucket } from "../rpc/rateLimiter";
import { RugcheckReport, RugcheckSummary } from "./schemas";
import { buildCrossCheck, type RugcheckCrossCheck } from "./crossCheck";

const BASE = "https://api.rugcheck.xyz";

/**
 * Auth header for the user's FluxRPC/RugCheck key. The API's CORS preflight
 * allows both `Authorization` and `X-API-KEY` (verified live 2026-08-25);
 * which one a FluxRPC key belongs in is confirmed by the keyed test in
 * DECODING notes — see src/lib/rugcheck/DECODING.md.
 */
const AUTH_HEADER = "authorization";

/**
 * Conservative shared limiter: RugCheck/FluxRPC don't publish per-plan rps,
 * so 2 rps it is — cross-checks only fire on user row-expansion anyway, and
 * results are cached per mint for the session by the caller.
 */
const rugcheckBucket = new TokenBucket(2);

export type RugcheckErrorKind = "quota" | "auth" | "http" | "network" | "parse";

export class RugcheckError extends Error {
  constructor(
    public readonly kind: RugcheckErrorKind,
    message: string,
  ) {
    super(message);
  }
}

async function get(path: string, key: string): Promise<unknown> {
  await rugcheckBucket.take();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { [AUTH_HEADER]: key } });
  } catch (e) {
    throw new RugcheckError("network", e instanceof Error ? e.message : "network error");
  }
  if (res.status === 429)
    throw new RugcheckError("quota", "rate limit / quota exhausted (HTTP 429)");
  if (res.status === 401 || res.status === 403)
    throw new RugcheckError("auth", `key rejected (HTTP ${res.status})`);
  if (!res.ok) throw new RugcheckError("http", `HTTP ${res.status}`);
  return res.json();
}

/** Two GETs per mint: the summary (curated risks, lpLockedPct) + the slice of
 * the full report the summary lacks (rugged, insider networks, creator tokens). */
export async function fetchCrossCheck(mint: string, key: string): Promise<RugcheckCrossCheck> {
  const [summaryRaw, reportRaw] = [
    await get(`/v1/tokens/${encodeURIComponent(mint)}/report/summary`, key),
    await get(`/v1/tokens/${encodeURIComponent(mint)}/report`, key),
  ];
  const summary = RugcheckSummary.safeParse(summaryRaw);
  const report = RugcheckReport.safeParse(reportRaw);
  if (!summary.success || !report.success) {
    throw new RugcheckError("parse", "response didn't match the expected RugCheck shape");
  }
  return buildCrossCheck(summary.data, report.data);
}
