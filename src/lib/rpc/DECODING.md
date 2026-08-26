# pump.fun decoding notes

Verified 2026-08-20 against live mainnet transactions (via a Helius RPC endpoint,
plain JSON-RPC methods only — nothing Helius-specific ended up in the shipped
code) and cross-checked against the official IDL at
[pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs)
(`idl/pump.json`, `idl/pump_fees.json`, `docs/instructions/*.md`).

## Headline finding: the protocol has moved a lot since the stub was written

The stub in this repo (and the historical docs it cited) assumed a simple
`create`/`buy` pair over standard SPL Token with Metaplex metadata. Live mainnet
is running a materially different v2 protocol:

- Mints are **Token-2022**, not legacy SPL Token. Name/symbol/uri live in the
  mint's own `TokenMetadata` extension — there is no separate Metaplex metadata
  account to fetch.
- Token creation is `create_v2` (16 accounts, +3 optional for non-SOL quote
  mints), not `create`. The legacy `create`/`buy` instructions still exist in
  the IDL but every live create transaction sampled used `create_v2`.
- Trading has `buy` (12 accounts, legacy) _and_ `buy_v2`/`sell_v2` (27 accounts,
  supports Mayhem mode and non-SOL quote mints via a separate fee program,
  `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`). Both variants are observed on
  freshly created tokens — a bundled first buy can be either `Buy` or `BuyV2`.

Program ID is unchanged: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, confirmed
both by the official docs and by recent (2026-08-20) finalized transactions on
mainnet.

## Decoding strategy: events and balance deltas, not instruction args

Given how many trade-instruction variants exist (`buy`, `buy_v2`,
`buy_exact_quote_in_v2`, `buy_exact_sol_in`, `sell`, `sell_v2`, plus whatever's
next), hand-decoding each one's raw borsh args would mean chasing every future
protocol revision. Two RPC-native shortcuts sidestep that entirely, and were
each verified byte-for-byte against live data before use:

1. **Anchor events over instruction args.** `create_v2` (and every trade
   instruction) emits a self-CPI "Program data:" log carrying a full
   `CreateEvent` / `TradeEvent` struct. Decoding that log line is simpler and
   more stable than parsing the instruction's own account list + args, and it's
   already present in `logsSubscribe` output — no extra `getTransaction` call
   needed for the launch feed itself.
   - `CreateEvent` discriminator `[27,114,169,77,222,235,99,118]`. Decoded a
     live `create_v2` transaction (`__fixtures__/pumpfun/create-v2-tx-1.json`)
     field-for-field; every byte was consumed (350/350) and every pubkey
     matched the instruction's own account list independently.
2. **Token-balance deltas over trade-instruction decoding.** To find who bought
   how much of a token in a given slot, this provider reads
   `meta.preTokenBalances`/`postTokenBalances` from `getTransaction` (already
   parsed by the RPC) rather than decoding `buy`/`buy_v2`/... — the balance
   delta is the same regardless of which instruction produced it, so this
   survives future instruction additions for free. See
   `decode.ts#slotActivityFromTransaction`.

## Verified account/data layouts

All of the following were decoded against live fixtures in
`__fixtures__/pumpfun/` and are covered by `pumpfun/decode.test.ts` and
`pumpfun/pda.test.ts`.

| Item                                                                                               | Verified against                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `create_v2` account order (16 accounts, matches IDL exactly)                                       | `create-v2-tx-1.json` instruction accounts, cross-checked field-by-field              |
| `CreateEvent` layout (17 fields)                                                                   | Same tx's "Program data:" log, full byte consumption                                  |
| `BondingCurve` account (10 fields, disc `[23,183,248,55,96,216,172,96]`)                           | `getAccountInfo` on the curve PDA right after creation — `bonding-curve-account.json` |
| `Global` account (through `initial_real_token_reserves`, disc `[167,232,232,177,200,108,114,127]`) | `getAccountInfo` on the global PDA — `global-account.json`                            |
| Bonding-curve PDA seeds `["bonding-curve", mint]`                                                  | Derived value matched the live tx's own `bonding_curve` account exactly               |
| Global PDA seeds `["global"]`                                                                      | Same                                                                                  |
| Token-2022 metadata via `getAccountInfo(mint, {encoding:"jsonParsed"})`                            | RPC's own parsed `tokenMetadata` extension matched the CreateEvent's name/symbol      |

Fixed supply: every sampled SOL-paired create used `token_total_supply =
1_000_000_000_000_000` raw units (6 decimals → 1B display supply,
`initial_real_token_reserves = 793_100_000_000_000`). `pumpfun.ts` uses this as
a documented fallback only if a mint's real create-time supply wasn't cached
(evicted from the 50-mint tracking window before a row was expanded) — every
normal path uses the mint's own real event/account data.

## Graduation formula

`BondingCurve.complete` flips true, and `real_token_reserves` hits exactly 0,
when the curve finishes (per the official docs' migration description). So
`curveProgressPct = 100 * (1 - real_token_reserves / initial_real_token_reserves)`
is 0% at creation (`real_token_reserves` starts equal to the denominator) and
exactly 100% at the documented completion condition — this is a property of the
formula's construction, not something that needed catching a token mid-graduation
to confirm. `complete: true` is treated as an explicit 100% override regardless
of reserves, in case rounding ever leaves reserves at a small nonzero value.

## Deliberate, disclosed scope reductions

Per `CONTRIBUTING.md`'s "honest gaps, never fabricate" rule, applied to a few
things the brief didn't fully resolve:

- **`deployerPriorLaunches` (section D):** `getSignaturesForAddress` has no
  program filter, so counting a deployer's prior pump.fun creates means
  fetching each candidate transaction. The brief's literal "limit 1000" would
  mean up to 1000 sequential `getTransaction` calls on a single row expand —
  far past the rate budget. Scoped down to the most recent 40 signatures
  (`deployerHistory.ts`), with `truncated: true` surfaced when the window was
  full so a shallow count is never presented as a lifetime total.
- **`deployerPriorRugs`:** cannot be verified from raw RPC, full stop — set to
  `0`, `Launch.rugHistoryVerified: false`, UI renders "rug history: unverified."
  This mirrors the brief's own instruction for this exact field.
- **`mcapUsd`:** raw RPC has no price oracle. The curve's virtual reserves give
  an exact SOL-denominated valuation; converting to USD needs one extra,
  keyless, no-auth read from Jupiter's public price API
  (`lite-api.jup.ag/price/v3`) — documented in `SECURITY.md`.
- **`vol1hUsd` / `holders`:** not obtainable from cheap RPC reads at all (no
  indexer, `getProgramAccounts` is explicitly forbidden, and scanning a token's
  full recent history for volume would cost more than the rest of the provider
  combined). Always `0`/`0` with `GraduationEntry.volHoldersVerified: false`;
  the UI shows "unverified" instead of a number that looks real.
- **Mayhem mode and non-SOL quote mints:** `create_v2`/`buy_v2` support both,
  but they're a small minority of launches and add real decoding surface
  (different fee accounts, a second token program for the quote leg). Out of
  scope for v0.1; a mint using either still gets a launch-feed row (the
  CreateEvent decodes fine either way) but its curve math assumes the standard
  SOL-paired path, so `mcapUsd`/`curveProgressPct` for a Mayhem-mode or
  alt-quote coin may be off. Not filtered out, but not specially handled.
- **Legacy (pre-`create_v2`) tokens pasted into Graduation:** `resolveQueuedMint`
  requires the mint to be a Token-2022 mint with the metadata extension. An
  older SPL-Token + Metaplex-metadata pump.fun token (if any such curve is
  still active) will fail to resolve with an explicit error rather than
  silently showing zeros.

## Public endpoints (SLOW MODE) — verified 2026-08-26, from a real browser

The zero-setup brief required real verification of public endpoints, and the
browser context turned out to be the test that matters:

**Solana — no browser-usable public endpoint exists.** `api.mainnet-beta.solana.com`
answers curl/node happily (getSignaturesForAddress limit=1000 in ~0.5s, 15/15
rapid calls OK, `logsSubscribe` over WS confirmed with 2,140 notifications in
12s) — and then returns **HTTP 403 to any browser-origin request**, WS included
(observed live in the running app: 4 WS failures → poll fallback → 403 per
tick). Every other free endpoint tested from a real browser context also
fails: `solana-rpc.publicnode.com` and `mainnet.solana.rpcpool.com` (CORS
fetch failure), `solana.drpc.org` ("chain is not available on free plan"),
`endpoints.omniatech.io` (blocked), `solana.api.onfinality.io` (429,
key-gated), `rpc.ankr.com/solana` (403, key-gated). Consequence: Solana ships
demo-until-key, stated honestly in Config; SLOW MODE is RHC-only until a
browser-open public Solana endpoint exists.

**Robinhood Chain — `https://rpc.mainnet.chain.robinhood.com` works from the
browser.** eth_blockNumber 200 from a browser fetch, 10/10 rapid calls OK,
eth_getLogs over a 2,000-block window OK, **no WebSocket** (handshake closes,
code 1006 — matching Robinhood's own docs), so the provider is configured
with `maxWsFailures: 1` to skip straight to polling. Verified end-to-end in
the running app: `FEED: LIVE · RPC: PUBLIC (SLOW)` with zero configuration.
SLOW MODE budget: 3 rps (the endpoint's ceiling was not probed to exhaustion
— it is shared infrastructure; the budget is deliberately conservative).

**CRT effects on mobile:** the only animations are two compositor-only
opacity keyframes (4s flicker, 1.1s cursor blink), both disabled under
`prefers-reduced-motion`; scanlines and vignette are static fixed gradients
painted once. No per-frame JS. An FPS sample couldn't be captured in the
audit harness (occluded renderer throttles rAF), so this paragraph argues
from the implementation instead of inventing a number.
