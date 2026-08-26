# FLURRY — Build Brief: Robinhood Chain Provider (EVM family)

Branch: `feat/robinhood-chain`. Open a tracking issue titled "Robinhood Chain
provider (EVM)" first and reference it in the PR. All gates green; stop before merge.

## Mission

Extend Flurry to Robinhood Chain (Arbitrum-stack L2, mainnet since 2026-07-01,
chain ID 4663, ETH gas, EVM). This is a second provider _family_ — the first
EVM implementation behind the existing `ChainProvider` seam. UI components must
not change beyond a chain selector and label plumbing.

User story unchanged: BYOK. User pastes a Robinhood Chain RPC URL (Alchemy
serves it free-tier with WS) into config; feed, forensics, and graduation work
the same way they do for Solana.

## Step 0 — Verify + survey before building (the meta is weeks old)

1. Verify chain basics live: chain ID 4663, block time ~100ms, ETH gas, via a
   real RPC call. Document in `src/lib/rpc/evm/DECODING.md`.
2. **Launchpad volume survey**: the landscape is unsettled (Noxa paused new
   creation in July; pools.trade by Uniswap Labs launched Aug; hood.fun,
   StonkBrokers, Robinlaunch, RobinPad, PONS all active). Query recent on-chain
   activity (contract creation events + launchpad factory events over the last
   ~7 days) to rank launchpads by actual launch count and trade volume.
   Pick the **top ONE by real volume** as the first decoder target, with a bias
   toward pools.trade if it's close (Uniswap Labs = durable contracts).
   Document the survey data and the pick in DECODING.md. Do not decode more
   than one launchpad in this PR.
3. Pull 5+ real launch transactions and 10+ buys from the chosen launchpad;
   derive event/calldata layouts from live data + verified contract source on
   the chain's Blockscout explorer. Save as fixtures.

## Schema generalization (do this first, separate commit)

- `LaunchProgram` enum grows: add the chosen Robinhood Chain launchpad as a
  value; add a `chain: "solana" | "robinhood"` field to `Launch` and
  `GraduationEntry` (zod enum, default "solana" for back-compat).
- Rename slot-specific fields chain-agnostically OR keep `deploySlot` and
  document that on EVM it holds the deploy **block number** — prefer the
  documented reuse over a churny rename; forensics functions treat it as an
  opaque "deploy unit" already. State the choice in DECODING.md.
- Address validation: current `min(32)` string checks must accept 0x-addresses.
  Tighten per-chain rather than loosening globally (discriminated by `chain`).
- Forensics functions (`detectBundle`, `clusterByFunding`, `scoreRisk`) are
  pure over these fields and should need zero or near-zero changes — if a
  change is needed, tests update in the same commit per CONTRIBUTING.md.

## EVM provider spec (`src/lib/rpc/evm/`)

- Shared EVM transport: JSON-RPC over the user's URL; WS `eth_subscribe`
  (newHeads/logs) with the same reconnect/backoff/poll-fallback pattern and
  the same shared rate limiter as the Solana provider. No new dependencies if
  reasonable — raw JSON-RPC calls are simple; if a minimal ABI decoder is
  genuinely needed, prefer viem and justify it in the PR description.
- Launch feed: subscribe to the launchpad factory's creation event via
  `eth_getLogs` topics / WS log subscription → decode → `Launch`.
- Bundle check (lazy, on expand): fetch the deploy block's transactions
  touching the token/pool; buyers in the deploy block → `SlotActivity` with
  block number as the deploy unit. 100ms blocks make same-block bundling a
  sharp signal; note calibration thoughts in DECODING.md if thresholds should
  differ per chain (thresholds stay in forensics, parameterized, tested).
- Funding lineage (lazy, capped 12): last inbound ETH transfer per buyer,
  one hop, via account tx scan. Same honesty rule: if the RPC can't answer it
  cheaply, label unverified rather than fake it.
- Deployer history: creation-event count by deployer over a bounded lookback;
  label truncated. Rug history stays "unverified" (same law as Solana).
- Graduation: chosen launchpad's curve state (e.g. bonding-curve contract
  reads, or graduation event tracking) → `curveProgressPct`. If the chosen
  launchpad has no curve (direct-pool style), the graduation tab shows its
  tokens as GRADUATED at listing and the brief's spirit is met — document it.
- mcapUsd: reuse the keyless price fetch pattern with ETH/USD (same source
  family as SOL/USD; extend SECURITY.md data-flow note).

## UI plumbing (minimal)

- Config: chain selector (SOLANA / ROBINHOOD) above the RPC field; the RPC
  field and helper text swap per chain (Alchemy link for Robinhood). Selection
  is in-memory like everything else.
- Scanner/Graduation: already render `platformLabel`; add a small chain tag.
- Dossier evidence: include the chain so verdict READs stay accurate.

## Testing

- Fixture tests for every decoder (real captured logs/txs), PDA-equivalent
  address derivations if any, curve math.
- Provider orchestration with mocked transport: lazy behavior, cache, fallback.
- Full suite green including all existing Solana tests — zero regressions.
- Manual acceptance: live Alchemy Robinhood Chain endpoint, watch real
  launches, expand rows, verify one bundle verdict against Blockscout by hand.
  Record in PR description.

## Docs

- README: coverage table gains a Robinhood Chain section with the same
  program-oriented honesty (what's covered, what's deferred, why the pick).
- DECODING.md (evm): survey data, layouts, verification dates, gaps.
- SECURITY.md: data-flow includes the second chain + ETH/USD fetch.

## Definition of done

- [ ] Step 0 survey data + decoder pick documented with on-chain evidence
- [ ] Schema generalized with back-compat; Solana tests untouched and green
- [ ] EVM transport + one launchpad decoded, fixtures committed
- [ ] Lazy forensics + honest unverified labels, same as Solana
- [ ] Chain selector UX with per-chain helper text
- [ ] Manual acceptance on live chain recorded
- [ ] All gates green; issue opened; PR open, not merged

## Out of scope

Second/third Robinhood launchpads (follow-up issues from the survey data),
other EVM chains, bridging anything, desktop bridge changes, Solana provider
changes beyond schema plumbing.
