# Security Model

Flurry is a fully static, client-side application. There is no backend.

## Key handling (the invariant)

- API keys and RPC URLs live in **React state in memory only**. They are never written to
  localStorage, IndexedDB, cookies, or any persistence layer. They die with the tab.
- The Anthropic key is sent **directly from the user's browser to `api.anthropic.com`**
  using the `anthropic-dangerous-direct-browser-access` header. This is acceptable because
  the key is the user's own; Flurry never proxies, logs, or stores it.
- Any PR that attaches persistence to `apiKeyAtom` will be rejected. This is a review gate,
  not a suggestion.

## Data flow

user browser ── RPC reads ──> user-supplied Solana RPC, or user-supplied Robinhood Chain RPC
user browser ── dossier calls (BYOK) ──> api.anthropic.com (user's key)
user browser ── dossier calls (DESKTOP BRIDGE) ──> http://localhost:PORT (same machine) ──> claude CLI (subscription) or api.anthropic.com (ANTHROPIC_API_KEY from the bridge's own shell env)
user browser ── SOL/USD price ──> lite-api.jup.ag (public, keyless, no data sent but the read itself)
user browser ── ETH/USD price ──> api.coingecko.com (public, keyless, same trust model)
user browser ── nothing ──> us. No telemetry, no analytics, no server.

The chain is a config selection (`[F3] CONFIG`), not a build-time choice — the same
static app talks to whichever RPC endpoint (and, for market cap, whichever public price
API) matches the chain you picked. Both price reads are a plain GET with no identifying
data in the request, same trust model as an RPC endpoint, needed because neither
chain's raw RPC exposes a price oracle.

## Desktop Bridge

DESKTOP BRIDGE mode (`bridge/flurry-bridge.mjs`) exists so an Anthropic key never has to
enter the page at all. It's a localhost-only server the user runs themselves; the page
only ever talks to `http://localhost:PORT` on the same machine. Three walls make that
safe to expose to a browser tab that could, in principle, be running alongside anything:

1. **Origin allowlist.** The bridge answers only an exact-match set of origins
   (`https://nerdherderdani.github.io`, `http://localhost:5173`, `http://localhost:4173`).
   Any other `Origin` header gets a bare 403 with no CORS headers at all — the browser
   never even sees a response it would render. Requests with no `Origin` header (the
   user's own `curl`) are allowed; that's the user talking to their own machine.
2. **Server-side prompt construction — no raw prompts, ever.** The bridge's `/v1/dossier`
   endpoint accepts only a fixed, hand-validated evidence shape (mirroring
   `DossierEvidence` in `src/lib/schemas.ts`) and builds the AI prompt itself from those
   validated fields. There is no code path from an HTTP request body to free text handed
   to Claude. A hostile page that somehow reached the port can get a token forensics
   verdict; it cannot get general-purpose Claude access. This is enforced by tests, not
   just described — see `bridge/flurry-bridge.test.js`.
3. **No persistence, no logging.** The bridge keeps no database and writes no evidence,
   prompts, or verdicts to disk or console — only a one-line
   `METHOD /path STATUS Ns` per request, same spirit as this app's zero-telemetry stance.

The Anthropic key, when the bridge falls back to `ANTHROPIC_API_KEY`, lives in the shell
environment that started the bridge process — never in the browser, never sent anywhere
except `api.anthropic.com`, exactly like the BYOK path above.

## Reporting

Open a GitHub security advisory or issue. Do not include keys or wallet secrets in reports.
