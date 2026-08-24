# Robinhood Chain decoding notes

Verified 2026-08-24 with real commands against live mainnet — not from memory, and not
from articles (the launchpad landscape here is weeks-old news; see the survey below for
why that matters).

## RPC endpoint used for this survey

Robinhood publishes a genuinely public, no-signup RPC
(`https://rpc.mainnet.chain.robinhood.com`, confirmed from their own docs) — used for
every verification call in this document. It has no WebSocket support and Robinhood's
own docs call it "not recommended for production," so the shipped provider (this PR)
is built and tested against a real Alchemy Robinhood Chain endpoint (WS-capable) for
the live feed, and only Step 0's read-only survey queries used the public RPC.

## Public RPC evaluation — is `rpc.mainnet.chain.robinhood.com` good enough to ship as the default?

Tested 2026-08-24 for real against the _built_ app (not just raw RPC calls) — a
user asked whether Flurry works with Robinhood's official public endpoint. Robinhood's
own docs call it "not recommended for production," which is why the initial ship used
Alchemy as the suggested default; this is the actual measurement of what that caveat
means in practice for this specific access pattern.

**Chain basics.** `eth_chainId` → `0x1237` (4663), correct, live.

**WebSocket.** `wss://rpc.mainnet.chain.robinhood.com` rejects the upgrade outright —
`Error during WebSocket handshake: Unexpected response code: 400` (confirmed both with
a raw `ws` client and inside the real app via Playwright). This is HTTP-only. The
provider's existing reconnect/poll-fallback logic (`evm/feed.ts`, same shape as the
Solana feed) handles this exactly as designed: 4 failed WS attempts with backoff
(500ms → 1000ms → 2000ms), ~6 seconds total, then falls back to 5s `eth_getLogs`
polling and stays there. Measured in the running app: `FEED: RECONNECTING` for ~6s,
then `FEED: LIVE` (poll mode) continuously for the rest of a 2.2-minute session, no
further reconnect attempts, zero console errors.

**`eth_getLogs` range behavior — no declared cap, but a real one.** Unlike Alchemy's
free tier (explicit "10 block range" rejection, see the fix below), this endpoint
returned real results with no error at every window size tested against the live
factory address:

| window (blocks)                                                                        | result                                                            | latency          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- |
| 10                                                                                     | `[]` (too narrow to catch anything at real launch cadence)        | fast             |
| 1,000 / 5,000 / 10,000 / 50,000                                                        | real logs returned                                                | fast             |
| 100,000 (`deployerHistory.ts`'s exact window)                                          | 92 real logs, 3 repeat runs                                       | ~0.24–0.27s each |
| full history (`0x0` → `latest`, ~45M blocks — `resolveQueuedMint`'s cold-lookup shape) | **`{"code":-32000,"message":"log query timed out"}`** after ~2.2s | —                |

So the bounded-window queries this provider actually issues (deploy-block bundle
check: 1 block; deployer history: 100,000 blocks) work fine and fast — no cap
observed up to at least 100k blocks, which is _more_ permissive than Alchemy's free
tier for exactly this provider's access pattern. Only a genuinely unbounded
full-history scan fails, with a timeout rather than a range-cap error. `resolveQueuedMint`
already degrades honestly here (checks the tracked-tokens cache first, so a mint
already seen in Scanner needs no RPC call at all; a genuine cache miss now gets a
clear "can't search full chain history" error — `robinhood.ts`'s
`describeQueuedMintLookupFailure` matches both providers' distinct rejection texts).

**CORS.** `access-control-allow-origin: *` on both the preflight and the real
request — no browser CORS issue.

**The "bot" 403 is a script fingerprint, not a browser block.** Raw `curl`/`urllib`
calls with a script-like User-Agent (Python's default `Python-urllib/3.x`) get a
Cloudflare `error code: 1010` 403; the identical request with a real Chrome UA string
returns `200`. Verified this doesn't affect the actual app: Playwright's Chromium
(a real browser engine) never hit this in the live test below.

**Realistic session (built app, Playwright, ~2.5 minutes: feed running, Scanner row
expanded for forensics, Graduation tab open and polling, back to Scanner).** Real
launch observed and expanded (`deployer ... 1 prior launches`, `bundle check clean
deploy slot`, `first block 100% of supply acquired`, `dev holds 1.9% of supply` — the
1-prior-launch, non-zero `deployerPriorLaunches` confirms the 100k-block deployer-history
query actually ran and decoded correctly). Zero console errors, zero 429s, `FEED: LIVE`
held for the full session with no further reconnects. (The Scanner row list appearing
empty right after switching back from the Graduation tab is `Scanner`'s own local
`rows` state resetting on remount — `App.tsx` unmounts the inactive tab — not a feed
or RPC issue; `FEED: LIVE` and the underlying feed connection are unaffected by tab
switches, since the provider instance is cached by `useChainProvider`.)

**Verdict: works acceptably, and is now the suggested zero-signup default in Config**,
with Alchemy kept as the documented "if throttled, or if you want push-based updates
instead of ~5s polling" upgrade path. Nothing here contradicts Robinhood's own
"not recommended for production" caveat in general — it likely means no SLA, no
support, and probably a lower ceiling under heavier load than what a small forensics
terminal's read pattern puts on it — but for this app's specific, bounded, read-only
access pattern it measured as fast, error-free, and CORS-friendly over a realistic
session.

## Step 0.1 — chain basics, verified live

| Fact       | Verified value                                                                             | Method                                                     |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Chain ID   | `4663` (`0x1237`)                                                                          | `eth_chainId`                                              |
| Client     | `nitro/v3.11.3-rc.9-.../go1.25.12`                                                         | `web3_clientVersion` — confirms Arbitrum Nitro/Orbit stack |
| Block time | exactly 100ms average (100 blocks spanned 10.000s: timestamps `1787591385` → `1787591395`) | two `eth_getBlockByNumber` calls 100 blocks apart          |
| Gas        | ETH, ~0.0213 gwei at survey time                                                           | `eth_gasPrice` → `0x1457850` wei                           |

All match the brief's stated basics exactly.

## Step 0.2 — launchpad volume survey

The brief's own framing ("the meta is weeks old") turned out to be the headline
finding: the most-repeated claim in current web coverage (PONS "running more than half
of Robinhood Chain's transactions", late July) is **stale**. On-chain data below
contradicts it directly.

**Method:** for each launchpad named in the brief, found candidate factory/router
contracts via Blockscout's verified-contract search
(`https://robinhoodchain.blockscout.com`), then checked _actual recent activity_ three
ways: (a) `eth_getLogs` against the candidate address over a real block-range window,
(b) Blockscout's per-address `/logs` endpoint (newest-first) to see the most recent
block that actually touched the contract, (c) for the top contender, decoded a live
transaction end-to-end to confirm the event stream matches what "a new token launch"
actually looks like on-chain, not just a plausible-sounding contract name.

| Launchpad                      | Candidate contract found                                                                                                                  | Verified recent activity                                                                                                                                                                                                                                                                                                                                  | Verdict                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Noxa**                       | `NoxaRouter4` `0x5F6593022A665b6D225a4F808cB23eCD60d123d4` — 38,007 lifetime txs                                                          | 646 logs in the last 7 days (real, still traded)                                                                                                                                                                                                                                                                                                          | **Excluded per brief** — paused new-token creation July 11; this is residual trading on old curves, not launch volume                   |
| **PONS**                       | `NiceHoodPonsFactory` `0x59D7A014FA693d491d482a93932cC65566F21B43` — verified source, emits `BondingCurveCreated`/`TokenPurchased`        | **0.** Its last on-chain event of any kind was block 23,312,466 → **2026-07-30**, 25 days before this survey. A chain-wide `eth_getLogs` search (no address filter) for its exact `BondingCurveCreated` and `TokenPurchased` topic hashes found **zero occurrences anywhere on Robinhood Chain in the last 7 days** — not just this one contract instance | **Dead.** The "PONS runs more than half of RHC" narrative is out of date; no successor contract reusing the same event schema was found |
| StonkBrokers                   | `MemeStonkFactory` `0xC5EEd...` — 1 tx; supporting contracts (Registry/Renderer/Hook/Escrow) — 0 txs each                                 | Negligible                                                                                                                                                                                                                                                                                                                                                | Minor                                                                                                                                   |
| RobinPad                       | `RobinpadFairlaunch` — several per-launch addresses, 0–6 txs each                                                                         | Negligible, and looks like one contract per launch rather than a shared factory                                                                                                                                                                                                                                                                           | Minor                                                                                                                                   |
| RobinLaunch                    | `RobinLaunchFactory` — 5–6 txs; `RobinLaunchpad` — 1 tx                                                                                   | Negligible                                                                                                                                                                                                                                                                                                                                                | Minor                                                                                                                                   |
| hood.fun                       | No confidently-identified factory found (only 0–4 tx generic-named contracts; no address published on hood.fun itself)                    | Unknown, but nothing found at meaningful scale                                                                                                                                                                                                                                                                                                            | Could not confirm it's a real contender                                                                                                 |
| **pools.trade** (Uniswap Labs) | `UERC20Factory` `0x000000e200088d55c39a11f609e5f667729ad49b`, called via `LiquidityLauncher` `0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0` | **595 `TokenCreated` logs in 24h** (measured directly; a 50-item page of real, consecutive `TokenCreated` events spanned only ~84 minutes of chain time) → roughly **4,000+ launches/week**, live and ongoing at survey time                                                                                                                              | **Winner, by a wide margin, and it's the only genuinely live candidate**                                                                |

**Pick: pools.trade (Uniswap Labs), decoding `UERC20Factory` + `LiquidityLauncher` +
`InstantLaunchStrategy`.** This isn't a "close call requiring the pools.trade bias" —
of the six named launchpads, five show negligible-to-zero real current activity (one
of them, PONS, actively contradicts its own recent press), and pools.trade is
verifiably firing hundreds of real token creations per day right now. Durable
contracts (Uniswap Labs backing, matches the brief's tie-break preference anyway) was
not the deciding factor here; live volume was.

## Step 0.3 — live transaction anatomy (verified against real txs + verified source)

A pools.trade launch is one `multicall` transaction to `LiquidityLauncher`
(`0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0`, verified source, tag "LiquidityLauncher
v3.2.0") that, in order, per a real decoded transaction
(`0x2eec9856b409e0d0c2c6d70f1d2b519e1b5b62017d2477e3b4f49c76ac4bd495`, block
45,063,867):

1. Calls `UERC20Factory.createToken(name, symbol, decimals, totalSupply, recipient, data, graffiti)` → mints the ERC-20, emits `UERC20Factory.TokenCreated(address tokenAddress, (string description, string website, string image, bytes extraData) metadata)`.
2. Emits its own `LiquidityLauncher.TokenCreated(address indexed tokenAddress)` (sparser — no metadata).
3. Creates a Uniswap v4 pool via the shared singleton `PoolManager`
   (`0x8366a39CC670B4001A1121B8F6A443A643e40951`) — `Initialize`, then `ModifyLiquidity`
   to seed it.
4. `InstantLaunchStrategy` (`0x23f8209572b4a1C2AD88A42749E830791Fb027f1`) emits
   `DistributionInitialized(address indexed distributor, address indexed token, uint256 totalSupply)`
   then `TokenLaunched(bytes32 indexed poolId, address indexed token, address indexed finalPositionRecipient, (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key)`.
5. `LiquidityLauncher.TokenDistributed(...)` (allocation payouts).
6. **A `PoolManager.Swap` in the same transaction** — the creator's bundled initial buy,
   the same pattern pump.fun uses. Decoded from the real tx:
   `amount0: -49000000000000000` (0.049 ETH in), `amount1: 19120395508637372338910994`
   (token out), confirming this is a real, sized buy, not a zero-amount pool-seed swap.

**This is a direct-pool launchpad — no bonding curve at all.** The name ("pools.trade")
is literal: tokens go straight into a live, tradeable Uniswap v4 pool at creation.
Per the brief's own anticipated fallback, the Graduation tab treats every pools.trade
token as **GRADUATED at listing** — `curveProgressPct` is always `100` the instant a
`TokenCreated` event is observed. There is no partial-curve state to poll.

All four event ABIs above were pulled from Blockscout's verified source for each
contract (not guessed), and decoded against the real fixture transactions in
`__fixtures__/` using `viem`'s `decodeEventLog` — see "why viem" below.

## Verified event/account layouts

| Item                                                                                                | Contract                                                                                                           | Verified against                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TokenCreated(address, (string,string,string,bytes))`                                               | `UERC20Factory` `0x000000e200088d55c39a11f609e5f667729ad49b`                                                       | 7 real fixtures in `__fixtures__/launch-tx-*.json`, decoded with viem, cross-checked against Blockscout's own decode                                                                                                             |
| `TokenCreated(address indexed)`                                                                     | `LiquidityLauncher` `0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0`                                                   | Same fixtures                                                                                                                                                                                                                    |
| `DistributionInitialized(address indexed, address indexed, uint256)`                                | `InstantLaunchStrategy` `0x23f8209572b4a1C2AD88A42749E830791Fb027f1`                                               | Same fixtures; indexed flags confirmed against verified ABI (an earlier guess without checking the real ABI got the indexed flags wrong and failed to decode — always pull the real ABI, don't infer it from a summary)          |
| `TokenLaunched(bytes32 indexed, address indexed, address indexed, tuple)`                           | Same                                                                                                               | Same                                                                                                                                                                                                                             |
| `Swap(bytes32 indexed id, address indexed sender, int128, int128, uint160, uint128, int24, uint24)` | Uniswap v4 `PoolManager` `0x8366a39CC670B4001A1121B8F6A443A643e40951` (shared singleton, not pools.trade-specific) | Same fixtures, decoded amounts match real bundled-buy sizes                                                                                                                                                                      |
| `name()`/`symbol()`/`decimals()`                                                                    | The created ERC-20 token itself                                                                                    | Standard ERC-20 view calls — no event carries name/symbol directly (only `metadata.description`, which pools.trade's UI actually populates with what looks like a _tweet caption_, not the token's display name — see gap below) |

## Why viem (not a hand-rolled decoder)

Solana's decode work (see `../DECODING.md`) hand-rolled a borsh reader because
pump.fun's layouts are fixed-width structs — cheap and safe to do by hand, and worth
it to keep the provider dependency-light. EVM ABI encoding for the types actually in
these events (`string`, `bytes`, and a `tuple` mixing both) uses offset-pointer,
length-prefixed dynamic encoding — decoding it correctly by hand is real, fiddly binary
work, and getting it subtly wrong (a name that only decodes correctly for the field
values that happen to appear in your test fixtures) is exactly the kind of bug this
project can't afford on a tool people use to judge whether a token is safe. `viem`'s
`decodeEventLog` is small, tree-shakeable, and used by essentially the entire EVM
tooling ecosystem — reimplementing it here would trade a well-tested dependency for a
hand-written one with less test coverage, for the same job.

## Deliberate, disclosed gaps (same "honest gaps, never fabricate" rule as Solana)

- **Token display name.** The `TokenCreated` event's `metadata.description` field is
  _not_ the token's display name in practice — in every sampled fixture it holds
  free-form text (a tweet URL, a caption) that the creator entered, while `name`/`symbol`
  only exist as `createToken`'s function _arguments_, not in any event. The provider
  reads them with two extra `eth_call`s (`name()`, `symbol()`) against the new token
  address rather than attempting to decode the wrapped `multicall` calldata (the entry
  contract's `multicall(bytes[])` bundles an inner `createToken(...)` call whose
  arguments are themselves ABI-encoded a second level deep — decodable, but two cheap
  read calls right after seeing the event is simpler and doesn't depend on the exact
  multicall shape staying stable).
- **Deployer.** The transaction's `from` field. Confirmed present on every fixture.
- **`deploySlot` reuse.** Per the schema-generalization commit: `Launch.deploySlot` and
  `SlotActivity.slot` hold the **block number** for Robinhood Chain launches, not a
  Solana slot. Forensics functions already treat this as an opaque "deploy unit" — no
  rename, see that commit's message.
- **Bundle-check threshold calibration.** 100ms blocks (vs. Solana's ~400ms) mean a
  "same deploy block" bundle signal is if anything _sharper_ here — bots share a block
  with the creator only when truly coordinated (front-run/atomic), not through normal
  network latency variance. `detectBundle`'s thresholds are left unchanged (parameterized,
  chain-agnostic already); this is a note for future tuning with labeled data, not a
  code change made on the basis of a hunch.
- **Funding lineage — not implemented on this chain, and not fakeable into looking
  implemented.** Solana's one-hop lineage works because `getSignaturesForAddress`
  gives an address-indexed transaction history "for free." Standard Ethereum
  JSON-RPC has **no equivalent** — there is no method that answers "what
  transactions touched address X" for an arbitrary EOA. Answering it would require
  a provider-specific indexing API (e.g. Alchemy's asset-transfers endpoint),
  which would break the "works with any generic EVM RPC" promise this provider
  makes (the same promise the Solana provider makes about not requiring
  Helius-specific calls). Per the brief's own rule — "if the RPC can't answer it
  cheaply, label unverified rather than fake it" — `SlotActivity.fundedBy` is
  simply never set for Robinhood Chain launches; `clusterByFunding` already
  treats that as "no lineage found," the honest answer, with zero code changes.
- **Deployer prior-launch count.** No program-filtered signature list exists on EVM
  either (`eth_getLogs` filtered to `UERC20Factory`'s `TokenCreated` topic _plus_ the
  deployer's address as `from` isn't directly filterable via topics since `from` isn't
  indexed in the event) — counted via a bounded recent-block window scan, same
  truncation-disclosure pattern as Solana's `deployerHistory.ts`.
- **`deployerPriorRugs`:** unverifiable from raw RPC — `0`, `rugHistoryVerified: false`,
  same law as Solana.
- **Graduation / curve progress:** always `100` at listing (direct-pool launchpad, no
  curve) — see "live transaction anatomy" above. `vol1hUsd`/`holders` face the same
  cheap-RPC ceiling as Solana's pump.fun provider and are `0`/`volHoldersVerified: false`.
- **mcapUsd:** same pattern as Solana's SOL/USD read — one keyless ETH/USD fetch (see
  SECURITY.md), combined with the pool's reserves for a fully-diluted valuation.
- **Free-tier `eth_getLogs` range caps — found live, fixed.** Manual acceptance against
  a real Alchemy free-tier endpoint surfaced a real bug: Alchemy's free tier rejects
  `eth_getLogs` outright once the requested block range exceeds 10 blocks, even when the
  query is topic-filtered to a single address. `deployerHistory.ts`'s 100,000-block scan
  and `resolveQueuedMint`'s full-history scans both hit this. Worse, `loadForensics`
  combined the fragile deployer-history call with the robust single-block bundle-check
  call via `Promise.all` — one rejecting silently discarded the other's already-correct
  result. Fixed: `deployerHistory.ts` and `forensics.ts` now degrade honestly (empty/zero,
  not a thrown error) on any `eth_getLogs` failure instead of taking a sibling call down
  with them; `resolveQueuedMint` now checks the in-memory tracked-tokens cache first (the
  common case — a mint just seen in Scanner needs no fresh RPC call at all) and, on a
  genuine cache miss, surfaces a clear "your RPC provider limits eth_getLogs to a narrow
  block range" error instead of a raw JSON-RPC rejection.
