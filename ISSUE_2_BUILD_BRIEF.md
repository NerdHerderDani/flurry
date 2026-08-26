FLURRY — Issue #2 Build Brief: Desktop Bridge (localhost agent, keyless mode)

Branch: feat/desktop-bridge. PR with all gates green; stop before merge.

Mission

Make DESKTOP BRIDGE mode real: dossier calls route to a local agent on the user's machine instead of api.anthropic.com, so no Anthropic key ever enters the page. The bridge preferentially uses Claude Code headless mode (claude -p), meaning a Claude Pro/Max subscription powers dossiers with zero API billing.

Two deliverables:

bridge/flurry-bridge.mjs — single-file Node server, zero npm dependencies (node:http, node:child_process, built-in fetch). A user runs it with one command.
Browser side — src/lib/ai/bridge.ts client + Config tab wiring + Scanner routing by modeAtom.
Step 0 — Verify before building
Verify current claude -p (print/headless) invocation syntax and output format against the installed CLI on this machine (claude --help, then a real test call). Do not trust memory; the CLI ships weekly.
Verify current Chrome behavior for https page → http://localhost fetch: localhost is a trustworthy-origin exception to mixed content, but Private Network Access (PNA) preflights may apply (Access-Control-Request-Private-Network request header → server must answer Access-Control-Allow-Private-Network: true). Verify current enforcement status and implement the response header regardless (harmless if unenforced). Document findings in bridge/BRIDGE_NOTES.md.
Verify Safari behavior; if https→localhost fails there, document "Chrome/Firefox recommended for bridge mode" in README + config tab copy rather than fighting it.
Bridge server spec
Port: default 4114, overridable via FLURRY_BRIDGE_PORT.
Endpoints:
GET /v1/health → { ok: true, backend: "claude-cli" | "api-key", version }.
POST /v1/dossier → accepts DossierEvidence JSON only (mirror the field list from src/lib/schemas.ts; validate every field manually — types, ranges, string length caps — since the bridge has no zod). Reject anything else 400.
Prompt is constructed server-side from validated fields, using the same template as src/lib/ai/anthropic.ts. Extract the template to src/lib/ai/prompt.ts as the single source; the bridge duplicates it with a // KEEP IN SYNC with src/lib/ai/prompt.ts comment (bridge stays single-file). The bridge MUST NOT accept or forward arbitrary prompt text. This is the injection wall — a hostile webpage reaching the port can only ever get token verdicts, never general Claude access.
Backend resolution order:
claude CLI on PATH → claude -p <prompt> (subscription-powered, preferred).
Else ANTHROPIC_API_KEY env set → direct fetch to api.anthropic.com (key lives in the shell env, still never in any browser).
Else: health reports no backend; dossier returns 503 with a setup hint. Test hook: FLURRY_BRIDGE_CMD env overrides the CLI command so tests can mock it.
CORS: exact-match allowlist only — https://nerdherderdani.github.io, http://localhost:5173, http://localhost:4173. Handle OPTIONS preflight; echo allowed origin (never *); include the PNA response header. Requests with a non-allowlisted Origin: 403, no CORS headers. Requests with no Origin (curl) are allowed — that's the user's own shell.
Rate limit: 10 dossiers/min, in-memory counter. 429 beyond.
Timeout: kill the CLI child / abort the fetch at 60s; return 504.
Privacy: no logging of evidence or verdicts. Startup banner + per-request one-line status (POST /v1/dossier 200 3.2s) only.
Startup banner prints: port, resolved backend, allowlisted origins, and the one-line copy-paste instruction for the config tab.
Browser side spec
src/lib/ai/bridge.ts: checkBridge(port): Promise<HealthResult> and runDossierViaBridge(evidence, port): Promise<string>. Zod-parse both responses.
Config tab, DESKTOP BRIDGE mode selected:
Port field (default 4114, in-memory atom like everything else).
Live status line polling health every 5s while the tab is visible: BRIDGE: CONNECTED (claude-cli) green / BRIDGE: NOT FOUND amber.
When not found, show the exact setup commands inline (curl the file from the repo's raw URL + node flurry-bridge.mjs), terminal-styled, copy button.
Replace the "tracked in issue #2" placeholder copy.
Scanner: onDossier routes by modeAtom — byok → existing anthropic client, desktop → bridge client. Error messages distinguish "bridge not running" from "bridge has no backend" (the 503 hint).
Testing
Pure units: evidence validation, CORS/origin decision, backend resolution (extract as functions inside the single file; import the file in vitest via a small export guard if (process.env.NODE_ENV !== "test") main()).
Integration: vitest spins the server on an ephemeral port with FLURRY_BRIDGE_CMD pointing at a stub script; assert health, a full dossier round-trip, origin rejection, PNA header presence, rate limiting, and the no-raw-prompt rejection.
Browser client: mocked-fetch tests for both success paths and both error kinds.
Manual acceptance: run the real bridge with real claude -p, run npm run dev, switch to DESKTOP BRIDGE, run a dossier on a live launch. Record in PR description.
Docs
README: new "Desktop Bridge" section — what it is, the subscription-vs-API-key distinction, the two-command setup, the Safari caveat.
SECURITY.md: extend the data-flow diagram with the bridge path and state the three walls: origin allowlist, server-side prompt construction (no raw prompts), no persistence/logging.
Definition of done
Step 0 findings in bridge/BRIDGE_NOTES.md (CLI syntax, PNA status, Safari)
Single-file zero-dep bridge with health + dossier, both backends, test hook
Injection wall verified by test: raw-prompt requests rejected
Origin allowlist + PNA header verified by test
Config tab: live status, port field, inline setup instructions
Scanner routes by mode; distinct error copy for the two failure kinds
README + SECURITY.md updated
All gates green; PR open, not merged
Out of scope

npm packaging, TLS, remote/non-localhost bridges, multi-user auth, streaming responses, using the bridge for anything besides dossier verdicts
