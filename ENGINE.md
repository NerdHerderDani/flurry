# FLURRY ENGINE — embed the forensics

**The pitch:** the forensics is open. Run it yourself, or embed it. We shipped
the hard part so you don't rebuild it. Wallets, bots, launchpads, and
terminals plug in Flurry's bundle/cluster/risk/verdict layer as a library —
no API key, no rate limits, no network hop, no trust in our uptime.

The engine is [`@flurry/forensics`](packages/forensics/README.md), extracted
from this repo with the app itself as consumer #1 — the app's full test suite
runs against the published surface, which is the regression guarantee that
the package and the product are the same engine.

## Public API

| Export                                                                                    | What it does                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `detectBundle(deploySlot, slotActivity)`                                                  | N distinct wallets acquiring supply in the exact deploy slot/block → `BundleReport`   |
| `clusterByFunding(slotActivity)`                                                          | groups buyers by common funding source → `FundingCluster[]`, largest first            |
| `linkedWalletCount(clusters)`                                                             | wallets sharing funding lineage with at least one other                               |
| `scoreRisk(input)`                                                                        | weighted additive score → `LOW / MODERATE / HIGH / CRITICAL`                          |
| `explainRisk(input)`                                                                      | deterministic plain-English verdict (`headline` + `sentences`), honesty-law compliant |
| `Launch`, `SlotActivity`, `GraduationEntry`, `DossierEvidence`, `Chain`, `isValidAddress` | the zod schema contract — parse at your boundary                                      |
| `ChainProvider`, `createDemoProvider()`                                                   | the data-source seam + reference implementation                                       |

## The invariants (semver-protected)

- **Unknown renders as unknown.** Unverifiable fields travel as explicit
  `…Verified` flags and surface as the word "unverified" in `explainRisk`
  output. The engine never fills a gap with a guess.
- **No fabricated signals.** Pure functions of your evidence; no hidden
  fetches, no cached global state.
- **Threshold changes are documented minor versions.** Consumers can pin a
  minor and know their tiers won't silently move.

## Writing a provider

1. Implement `subscribeLaunches(onLaunch)` from your data source (WS or
   polling — your transport, your rate limits). Emit `Launch` objects; parse
   with the exported schema so bad data fails at your boundary, not in the UI.
2. Implement `getGraduationCandidates()` for curve tracking, and optionally
   `loadForensics(launch)` (lazy deploy-slot activity + deployer history — the
   expensive part, fetched on demand) and `resolveQueuedMint(mint)`.
3. Fields you cannot verify from your data source: set the corresponding
   `…Verified` flag false and zero the value. The engine and any UI built on
   it will render them as unverified — that's the contract, not a failure.

The live pump.fun / Raydium LaunchLab / Meteora DBC / EVM providers in
`src/lib/rpc/` are working examples (they are not exported — they carry
app-specific RPC and rate-limit choices — but they're Apache-2.0 like
everything else; read them).

## Hosted API: deliberately deferred

A keyed, hosted verdict API (the RugCheck model) is a **documented possible
future, not a commitment** — see [ENGINE_DECISION.md](ENGINE_DECISION.md) for
the full reasoning. If it ever exists it will be a thin wrapper over this
exact package, so the library is the reference implementation either way, and
nothing you build on the package is bet on our infrastructure.

## Releases

Semver from 0.1.0. Publishing is a manual operator action after review —
never automated in CI. `npm publish --dry-run` runs in CI to keep the
package publishable at all times.
