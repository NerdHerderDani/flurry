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

## Auth header

- Swagger `securityDefinitions`: apiKey in header `Authorization`.
- The CORS preflight also allows `X-API-KEY`.
- The keyed verification (operator key, tested against the auth-required
  `/lockers` endpoint) settles which header a FluxRPC-issued key belongs in;
  the result is recorded here and encoded as `AUTH_HEADER` in `client.ts`.

## Rate limits

FluxRPC/RugCheck publish no per-plan rps numbers. Shipped behavior: a
dedicated 2 rps token bucket, fetch only on user row-expansion, per-mint
session cache, no retry on 429/auth errors, and an honest "quota exhausted"
panel state instead of stale or guessed data.

## Precision hazard

`insiderNetworks[].tokenAmount` exceeds `Number.MAX_SAFE_INTEGER` in real
responses (observed: 1591714566162190193). This module reads only counts and
percentages; never consume that field without bigint handling.

## Fixtures

- `__fixtures__/summary-jto.json` — byte-real captured summary (JTO mint).
- `__fixtures__/report-jto-trimmed.json` — real captured report; the 300-entry
  `markets` and 20-entry `topHolders` arrays are trimmed to 2–3 entries for
  repo size. Every field the code reads is untouched.
