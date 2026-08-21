# Desktop bridge — Step 0 verification notes

Verified 2026-08-21 with real commands on this machine, not from memory.

## 1. `claude -p` invocation and output format

Installed version: `claude --version` → `2.1.238 (Claude Code)`, at `/Users/danischlarmann/.local/bin/claude`.

Relevant flags from `claude --help` (this exact install):

- `-p, --print` — print response and exit (headless mode).
- `--output-format <format>` — `"text"` (default, raw stdout, no structure) or `"json"` (single
  structured result) or `"stream-json"`. The bridge uses **`json`**: it's the only mode that
  reliably distinguishes success from failure without scraping text.
- `--tools <tools...>` — `""` disables all tools, `"default"` enables the built-in set. The bridge
  always passes `--tools ""`: a dossier call is pure text generation over evidence we already
  built server-side: there is no reason for the CLI to touch the filesystem, run bash, or hit the
  network on our behalf, and disabling tools removes an entire class of risk if this were ever
  invoked on attacker-influenced input.

Real invocation and output, `claude -p "Reply with exactly the single word: PONG" --output-format json --tools ""`:

```json
{
  "is_error": false,
  "result": "PONG",
  "subtype": "success",
  "session_id": "9bad5299-...",
  "total_cost_usd": 0.0037175,
  "type": "result",
  "duration_ms": 2953
  /* ...usage/modelUsage/etc — the bridge only reads is_error and result */
}
```

Real error case (invalid `--model` used to force one), confirming shape on failure:

```json
{ "is_error": true, "result": "There's an issue with the selected model (...)...", "subtype": "success", "api_error_status": 404, ... }
```

Process exit code is `1` on error, `0` on success — the bridge checks both the exit code and
`is_error` (belt and suspenders; `is_error` is the one that fires even when the process itself
still exits 0, e.g. a model returning an error message as its actual reply).

Argv-based `spawn(cliCommand, ["-p", prompt, "--output-format", "json", "--tools", ""])` (no
shell) was tested with a prompt containing embedded quotes and a literal newline — passed through
byte-for-byte with no escaping needed, confirming the injection-safety of not going through a
shell to invoke the CLI.

The bridge reads only `is_error` and `result` from this JSON. Everything else (session id, cost,
token usage) is dropped — per the brief's privacy requirement, none of it is logged or forwarded.

## 2. Private Network Access (PNA) — Chrome

**Status as of Chrome 151/152 (current stable, August 2026): fully enforced, no fallback.**

- Chrome 104: preflights sent, warnings only.
- Chrome 113+: enforcement began, with a deprecation-trial opt-out for site operators.
- **Chrome 142: the deprecation trial ended. PNA is now fully enforced with no escape hatch.**
  Sites at 151/152 (current) are well past this.

Mechanism: Chrome sends a CORS preflight (`OPTIONS`) ahead of any subresource request where the
target's IP address space is "more private" than the requester's. `127.0.0.1`/`localhost` is
"local" address space, so an `https://` page fetching `http://localhost:PORT` **always** triggers
this, regardless of the mixed-content exception below. The preflight carries
`Access-Control-Request-Private-Network: true`; the server's preflight response must carry
`Access-Control-Allow-Private-Network: true` or the browser blocks the real request.

**This means the brief's framing ("implement the header regardless — harmless if unenforced") is
now understated: the header is not a hedge against a future rollout, it is a hard requirement for
the bridge to work at all in current Chrome.** The bridge sends it unconditionally on every
`OPTIONS` response from an allowlisted origin.

Separately: `https://` → `http://localhost` has always been exempt from _mixed-content_ blocking
(`localhost` is on the browser's "potentially trustworthy origins" allowlist independent of
scheme) — that part of the brief's framing was correct and still holds. PNA is an additional,
independent check on top of that, not a replacement for it.

## 3. Safari

Safari has no `localhost` exception to its mixed-content policy — unlike Chrome/Firefox/Edge, it
blocks `https://` → `http://localhost` fetches outright ("blocked mixed content" in the console),
and this has been Safari's behavior for years with no 2026 change found. There is no PNA-style
header workaround for this because it isn't a PNA check — it's a stricter mixed-content policy
than Chrome's.

**Decision: don't fight this.** README and the Config tab's bridge copy say "Chrome or Firefox
recommended for Desktop Bridge mode — Safari blocks the localhost connection outright."

## Bottom line for implementation

- Use `claude -p <prompt> --output-format json --tools ""` via `spawn` (no shell), read
  `is_error`/`result`.
- Every `OPTIONS` response to an allowlisted origin must include
  `Access-Control-Allow-Private-Network: true` — required, not optional, on current Chrome.
- Document the Safari limitation instead of attempting a workaround.
