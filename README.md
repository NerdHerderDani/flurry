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
  VERDICT / CONFIDENCE / READ block comes back.
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
| Live pump.fun provider (RPC)                   | 🔜 issue #1    |
| Desktop bridge (localhost agent, keyless)      | 🔜 issue #2    |
| Additional platform providers                  | 🔜             |

## Support

Free forever. If Flurry saved you from a bundled launch, the tip jar is in the
terminal's `[F4] SUPPORT` tab.

## Not financial advice

It's forensics. Verdicts are heuristics plus a language model reading evidence.
Do your own research; this tool just makes the research faster.

## License

Apache-2.0
