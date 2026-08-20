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

user browser ── RPC reads ──> user-supplied Solana RPC
user browser ── dossier calls ──> api.anthropic.com (user's key)
user browser ── nothing ──> us. No telemetry, no analytics, no server.

## Reporting

Open a GitHub security advisory or issue. Do not include keys or wallet secrets in reports.
