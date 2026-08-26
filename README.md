# FLURRY 慌 TERMINAL

Retro terminal for token launch forensics — Solana and Robinhood Chain. Watches
launches across platforms, flags **bundled deploys**, maps **linked wallet clusters**,
surfaces **deployer history**, and tracks **bonding curve graduation** (or, on
direct-pool launchpads, listing) — with optional AI dossier verdicts powered by your
own Anthropic key.

**Free forever. BYOK. Zero custody. No backend, no telemetry, no token.**

## How it works

- **Fully static.** The entire app is client-side. Deploys to GitHub Pages.
- **Two chains, one seam.** Solana (pump.fun) and Robinhood Chain (pools.trade) both
  implement the same `ChainProvider` interface — pick a chain in `[F3] CONFIG`, the UI
  doesn't otherwise change.
- **BYOK.** You supply your own Anthropic API key and chain RPC endpoint. Both live in
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

## Getting started

Open the app. That is the whole setup.

- **Robinhood Chain:** the live feed and forensics run immediately on
  Robinhood's public RPC in `SLOW MODE` — no key, no signup, a conservative
  request budget, `RPC: PUBLIC (SLOW)` in the header.
- **Solana:** no public endpoint accepts browser traffic (every free one
  tested blocks it — verified with real calls, see
  [`src/lib/rpc/DECODING.md`](src/lib/rpc/DECODING.md)), so Solana shows the
  demo feed until you paste one free key from
  [helius.dev](https://www.helius.dev) in `[F3] CONFIG`.
- **Full speed** on either chain: paste a free RPC key — that's the upgrade,
  not the entry fee. Keys live in memory for the session only, as always.

Every expanded row opens with a **plain-English verdict** (instant, free, no
key), the raw forensics underneath, tap-to-explain glossary terms on the
jargon, and a `SHARE SCAN` button that copies a `?chain=…&mint=…` deep link.
The AI dossier is the deeper read on top, not the entry point.

## Run it locally

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
| Live Robinhood Chain provider (pools.trade)    | ✅             |
| Desktop bridge (localhost agent, keyless)      | ✅             |
| RugCheck cross-check (optional BYOK, Solana)   | ✅             |
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

## RugCheck cross-check (optional)

Paste a [RugCheck/FluxRPC key](https://fluxrpc.com/docs/rugcheck) in `[F3] CONFIG` and
expanded Solana rows gain a **CROSS-CHECK** panel: rugged status, LP locks, insider
networks, and RugCheck's own risk score, all clearly attributed to rugcheck.xyz. Strict
enrichment rules:

- **No key → nothing changes.** Flurry behaves exactly as before; no request is ever made.
- **Second opinion only.** Flurry's RISK verdict is computed independently from raw chain
  data and is never influenced by RugCheck.
- **AI dossiers** gain a source-labeled `rugcheck` evidence section — numbers and booleans
  only, so no third-party text can reach the prompt (see [SECURITY.md](SECURITY.md)).
- Solana only; Robinhood Chain rows are unaffected. Quota exhaustion shows an honest
  error state instead of stale or guessed data.

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

## Robinhood Chain coverage

Robinhood Chain (Arbitrum-stack L2, chain ID 4663, mainnet since 2026-07-01) launched
into an unsettled launchpad landscape — Noxa (the early dominant venue) paused new-token
creation in July, and several newer entrants (hood.fun, StonkBrokers, Robinlaunch,
RobinPad, PONS) exist with varying degrees of real activity. Same program-oriented
honesty as Solana: the pick is decided by verified on-chain volume, not by branding or
press coverage, and is documented with the actual survey numbers in
[`src/lib/rpc/evm/DECODING.md`](src/lib/rpc/evm/DECODING.md).

| Launchpad                           | Verified recent activity (2026-08-24)                                                      | Status                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **pools.trade** (Uniswap Labs)      | ~600 real `TokenCreated` events/day, live and climbing                                     | ✅ Covered                                           |
| Noxa                                | 646 logs/7d, but paused new-token creation in July                                         | Excluded — residual trading only, not launch volume  |
| PONS                                | **Zero** on-chain activity in the last 7 days, chain-wide, for its documented event schema | Dead — current press coverage about it is stale      |
| StonkBrokers, RobinPad, RobinLaunch | Single-digit-to-low-double-digit lifetime transactions                                     | Not covered — negligible volume                      |
| hood.fun                            | No confidently-identified active contract found                                            | Not covered — couldn't confirm it's a real contender |

pools.trade is a **direct-pool launchpad** — tokens go straight into a live Uniswap v4
pool at creation, with no bonding curve. The Graduation tab reflects that honestly:
every pools.trade token shows **GRADUATED** the instant it's created, rather than a
fabricated curve-progress number. Funding-lineage wallet clustering is also honestly
absent for this chain (not unverified-and-hidden — genuinely not computed): standard
Ethereum JSON-RPC has no address-indexed transaction history the way Solana's
`getSignaturesForAddress` provides, so "who funded this wallet" isn't answerable
without a provider-specific indexing API, which would break the BYOK-any-RPC promise.

## Support

Free forever. If Flurry saved you from a bundled launch, the tip jar is in the
terminal's `[F4] SUPPORT` tab.

## Not financial advice

It's forensics. Verdicts are heuristics plus a language model reading evidence.
Do your own research; this tool just makes the research faster.

## Disclosure

The developer works at Jito Labs, holds JTO, and earns JTX referral fees:
the `TRADE ON JTX ↗` links in the Graduation and Support tabs carry a referral
code. Trading through them costs you nothing extra — the referral share (20%
of the fees you were paying anyway) is paid by JTX to the developer, and the
80% of JTX platform fees committed to JTO buybacks and burns under JIP-38 is
unaffected. Per [Jito's launch announcement (PRNewswire, July 21, 2026)](https://www.prnewswire.com/news-releases/jito-labs-launches-jtx-a-platform-purpose-built-for-professional-traders-302830219.html):
"80% of that revenue goes to the Jito DAO to buy back and burn JTO,
permanently removing it from circulation. The remaining 20% goes to referrers
based on the trading activity they or their referrals generate." Flurry itself
remains free, keyless, and telemetry-free; the referral links are the only
monetization in the app.

## License

Apache-2.0
