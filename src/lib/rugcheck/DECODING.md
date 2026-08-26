# RugCheck integration — research trail

## API surface — VERIFIED 2026-08-25

- Base: `https://api.rugcheck.xyz` (FluxRPC's docs at fluxrpc.com/docs/rugcheck
  wrap this API). Swagger spec captured from `/swagger/doc.json`.
- Endpoints used:
  - `GET /v1/tokens/{mint}/report/summary` → `dto.TokenCheckSummary`
    (risks[], score, score_normalised 0–100, lpLockedPct)
  - `GET /v1/tokens/{mint}/report` → untyped in swagger; real shape captured
    live for the JTO mint (see `__fixtures__/`): rugged, insiderNetworks[],
    graphInsidersDetected, creatorTokens, score_normalised, risks[]
- Both endpoints answer **without** a key (the key buys plan rate limits);
  `/v1/tokens/{id}/lockers` and the bulk endpoints hard-require auth.

## CORS — VERIFIED 2026-08-25 (the Step-0 gate)

- `OPTIONS /v1/tokens/{id}/report/summary` with
  `Origin: https://nerdherderdani.github.io` → 204 with
  `access-control-allow-origin: *`,
  `access-control-allow-headers: Authorization,X-Wallet-Address,X-API-KEY,Content-Type,Content-Length,Origin`,
  methods GET/POST/PUT/DELETE/OPTIONS/HEAD.
- Plain GET with the same Origin → 200 + `access-control-allow-origin: *`.
- Conclusion: **direct browser calls are permitted from our origins** — no
  desktop-bridge routing needed for RugCheck reads.

## Auth — VERIFIED 2026-08-25 (keyed test, operator key)

- FluxRPC's RugCheck getting-started doc: keys go in the `X-API-KEY` header
  ("preferred") or `?key=` query param. We use the header only — a key in a
  URL leaks into server logs and browser history, violating our own hygiene.
- Keys must be created under the **RugCheck section** of the FluxRPC
  dashboard. Live test with the operator's general RPC-product key against
  `api.rugcheck.xyz`: HTTP 401 `{"error":"invalid api key"}` on every header
  variant — RPC keys and RugCheck keys are separate credentials.
- **401 responses carry no CORS headers** (verified live): in a browser a
  rejected key surfaces as an opaque fetch failure, not a readable 401. The
  client's error copy accounts for this.
- Swagger's `securityDefinitions` (header `Authorization`, "JWT token")
  describes RugCheck's own wallet-login JWT flow, not FluxRPC keys.

## Rate limits — DOCUMENTED 2026-08-25

FluxRPC documents **1 rps for anonymous access**; keyed-plan rps is not
published. Shipped behavior: a dedicated 1 rps token bucket (the honest
floor), fetch only on user row-expansion, per-mint session cache, no retry on
429/auth errors, and an honest "quota exhausted" panel state instead of stale
or guessed data.

## Precision hazard

`insiderNetworks[].tokenAmount` exceeds `Number.MAX_SAFE_INTEGER` in real
responses (observed: 1591714566162190193). This module reads only counts and
percentages; never consume that field without bigint handling.

## Fixtures

- `__fixtures__/summary-jto.json` — byte-real captured summary (JTO mint).
- `__fixtures__/report-jto-trimmed.json` — real captured report; the 300-entry
  `markets` and 20-entry `topHolders` arrays are trimmed to 2–3 entries for
  repo size. Every field the code reads is untouched.
