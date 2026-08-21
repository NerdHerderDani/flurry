# FLURRY 慌 TERMINAL

Retro terminal for Solana token launch forensics. Watches launches across platforms
(pump.fun, Axiom, FOMO, and friends), flags **bundled deploys**, maps **linked wallet
clusters**, surfaces **deployer history**, and tracks **bonding curve graduation** —
with optional AI dossier verdicts powered by your own Anthropic key.

**Free forever. BYOK. Zero custody. No backend, no telemetry, no token.**

## How it works

- **Fully static.** The entire app is client-side. Deploys to GitHub Pages.
- **BYOK.** You supply your own Anthropic API key and Solana RPC endpoint. Both live in
  memory for the session only — see [SECURITY.md](SECURITY.md).
- **Forensics engine.** Pure, unit-tested heuristics:
  - _Bundle detection_ — N distinct wallets acquiring supply in the exact deploy slot
  - _Wallet clustering_ — buyers grouped by common funding lineage
  - _Risk scoring_ — weighted tiers (LOW / MODERATE / HIGH / CRITICAL)
- **AI dossiers.** Structured evidence (never raw chain soup) goes to Claude; a blunt
  VERDICT / CONFIDENCE / READ block comes back — either straight to Anthropic with your
  own key, or via the [Desktop Bridge](#desktop-bridge) so no key ever touches the page.
- **Graduation tab.** Queue tickers, watch curve completion, catch tokens at CLOSE (≥90%)
  before they graduate.

## Run it

```sh
npm install
npm run dev
```

## Status

| Surface                                        | State          |
| ---------------------------------------------- | -------------- |
| Terminal UI, tabs, boot sequence               | ✅             |
| Forensics engine (bundle / cluster / risk)     | ✅ unit-tested |
| AI dossiers (BYOK, direct browser → Anthropic) | ✅             |
| Demo chain feed                                | ✅             |
| Live pump.fun provider (RPC)                   | ✅             |
| Desktop bridge (localhost agent, keyless)      | ✅             |
| Additional platform providers                  | 🔜             |

## Desktop Bridge

DESKTOP BRIDGE mode routes AI dossier calls to a tiny local server on your own machine
instead of sending an Anthropic API key into the browser at all. It's a single
zero-dependency Node file — nothing to install beyond Node itself.

**Subscription, not API billing.** The bridge prefers the `claude` CLI (Claude Code) if
it's on your `PATH`: dossiers are then powered by your Claude Pro/Max subscription, with
zero API-key billing. If the CLI isn't installed, it falls back to an `ANTHROPIC_API_KEY`
set in the same shell — the key lives in your terminal's environment, never in the
browser, either way.

**Setup — two commands, in a terminal on your machine:**

```sh
curl -O https://raw.githubusercontent.com/NerdHerderDani/flurry/main/bridge/flurry-bridge.mjs
node flurry-bridge.mjs
```

Then in the app: `[F3] CONFIG` → `DESKTOP BRIDGE` → set the port (default `4114`, printed
in the bridge's own startup banner). The status line updates live.

**Security model**, see [SECURITY.md](SECURITY.md) for the full picture — briefly: the
bridge only accepts a fixed set of evidence fields and builds the AI prompt itself
server-side (a hostile page reaching the port can get a token verdict, never arbitrary
Claude access), only talks to an exact allowlist of origins, and logs nothing but
method/status/timing.

**Browser support:** Chrome and Firefox both allow an `https://` page to reach
`http://localhost` (with the required [Private Network
Access](https://developer.chrome.com/blog/private-network-access-preflight) preflight,
which the bridge answers). **Safari blocks this outright** — there is no localhost
exception in its mixed-content policy, and no header fixes that. Use Chrome or Firefox
for bridge mode. See [bridge/BRIDGE_NOTES.md](bridge/BRIDGE_NOTES.md) for the verification
trail.

## Coverage plan

Coverage is **program-oriented, not brand-oriented**: most launchpads are skins on
shared infrastructure, so one decoder per on-chain program covers every skin on it.

| Phase    | Program           | Covers                               | Rationale                                                                     |
| -------- | ----------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| v0       | pump.fun          | pump.fun                             | Dominant venue (~98% of launchpad revenue, Aug 2026); majority of graduations |
| v0.2     | Raydium LaunchLab | LetsBonk.fun + 10+ third-party skins | Best coverage-per-integration; skin identified via platform config account    |
| v0.3     | Meteora DBC       | Believe, Bags, others                | Open-source curve implementation; creator-launchpad segment                   |
| Deferred | Moonshot          | Moonshot                             | Own program, ~1% share, Jupiter mobile audience                               |
| Skip     | Heaven, Boop      | —                                    | Unproven / marginal; revisit if either survives two quarters                  |

Trading terminals (Axiom, FOMO, Photon, GMGN) are **not** coverage targets — they are
where launches surface, not where they happen. Flurry competes in that category.

## Support

Free forever. If Flurry saved you from a bundled launch, the tip jar is in the
terminal's `[F4] SUPPORT` tab.

## Not financial advice

It's forensics. Verdicts are heuristics plus a language model reading evidence.
Do your own research; this tool just makes the research faster.

## License

Apache-2.0
