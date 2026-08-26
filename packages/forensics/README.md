# @flurry/forensics

Token-launch forensics engine: bundle detection, wallet clustering, risk
scoring, and plain-English verdicts. **This is the same engine that powers
[FLURRY 慌](https://github.com/NerdHerderDani/flurry)** — the app is just
consumer #1 of this package.

Pure, deterministic functions over evidence _you_ supply. No network calls, no
DOM, no keys, no telemetry. Zero runtime dependencies beyond
[zod](https://github.com/colinhacks/zod). ESM + types, tree-shakeable.

## Honesty invariants (you can build on these)

1. **Unknown renders as unknown.** Fields the caller can't verify are carried
   as explicit flags (`rugHistoryVerified`, `volHoldersVerified`) — never
   guessed, never interpolated — and `explainRisk` names them "unverified" in
   its plain English.
2. **No fabricated signals.** Every output is a deterministic function of the
   evidence passed in. Same input, same verdict, forever, on your machine.
3. **Threshold changes are documented minors.** Any change to a heuristic
   threshold or tier boundary lands as a minor version with a changelog entry.

## Quickstart — bring evidence, get a verdict

```ts
import {
  detectBundle,
  clusterByFunding,
  linkedWalletCount,
  scoreRisk,
  explainRisk,
} from "@flurry/forensics";

const bundle = detectBundle(deploySlot, slotActivity); // your chain data
const clusters = clusterByFunding(slotActivity);
const linked = linkedWalletCount(clusters);
const { tier } = scoreRisk({
  bundled: bundle.bundled,
  firstBlockSupplyPct: bundle.deploySlotSupplyPct,
  linkedWallets: linked,
  deployerPriorRugs,
  devHoldsPct,
});
const verdict = explainRisk({ ...evidence, tier }); // { headline, sentences, tier }
console.log(verdict.headline, verdict.sentences.join(" "));
```

## Write your own provider

The `ChainProvider` interface is the seam: implement `subscribeLaunches`,
`getGraduationCandidates`, and (optionally) `loadForensics` /
`resolveQueuedMint` against your own RPC and transport, and everything above
works on your chain. `createDemoProvider()` ships as a reference
implementation and a test double. The live pump.fun / LaunchLab / Meteora DBC /
EVM providers are deliberately **not** exported — they carry app- and
RPC-specific concerns; see [ENGINE.md](../../ENGINE.md) for the
provider-authoring guide.

## What's exported

`detectBundle` · `clusterByFunding` · `linkedWalletCount` · `scoreRisk` ·
`explainRisk` — the engine. `Launch` · `SlotActivity` · `GraduationEntry` ·
`DossierEvidence` · `Chain` · `isValidAddress` — the schema contract (zod).
`ChainProvider` · `createDemoProvider` — the seam and its reference impl.
Types: `RiskTier`, `LocalVerdict`, `BundleReport`, `FundingCluster`,
`ExplainInput`, `RiskInput`.

## License

Apache-2.0. The forensics is open: run it yourself, or embed it. We shipped
the hard part so you don't rebuild it.
