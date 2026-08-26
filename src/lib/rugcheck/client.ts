import { TokenBucket } from "../rpc/rateLimiter";
import { RugcheckReport, RugcheckSummary } from "./schemas";
import { buildCrossCheck, type RugcheckCrossCheck } from "./crossCheck";

const BASE = "https://api.rugcheck.xyz";

/**
 * Per FluxRPC's RugCheck getting-started doc (verified live 2026-08-25):
 * keys go in the `X-API-KEY` header (their "preferred" option; `?key=` also
 * exists but a key in a URL leaks into logs, so it's not used here). The key
 * must be created under the *RugCheck section* of the FluxRPC dashboard — an
 * RPC-product key gets `{"error":"invalid api key"}`. See DECODING.md.
 */
const AUTH_HEADER = "X-API-KEY";

/**
 * FluxRPC documents 1 rps for anonymous access and no explicit number for
 * keyed plans, so 1 rps is the honest floor — cross-checks only fire on user
 * row-expansion anyway, and results are cached per mint for the session by
 * the caller.
 */
const rugcheckBucket = new TokenBucket(1);

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
  } catch {
    // RugCheck's 401 responses carry no CORS headers (verified 2026-08-25), so
    // in a browser a rejected key lands HERE as an opaque fetch failure — not
    // in the 401 branch below. Say so instead of guessing "network down".
    throw new RugcheckError(
      "network",
      "request failed — either a network problem, or the key was rejected (a rejected key surfaces as a CORS failure in browsers)",
    );
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
