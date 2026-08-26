# CACHE_DECISION.md — shared read cache: GO / NO-GO

**Verdict: split, and the split is the finding.**

- **NO-GO** on the goal as framed — a warm cache behind the **live launch feed**,
  giving a keyless visitor instant forensics on brand-new launches. Honest cost:
  **~$1,000/month** in RPC alone, against **no revenue line**. See §1.
- **GO** on a narrower thing that is genuinely **$0/month**: precomputed static
  JSON snapshots of a **bounded curated set** (graduation candidates + a
  liquidity-ranked trending list), regenerated on a schedule in CI and served
  from the existing Pages CDN — **architecture option (b)**. See §3.

Cost at 1k DAU for the recommended scope: **$0/month** (fits free tiers).
Cost at 1k DAU for the full-feed scope: **~$999–1,100/month**, and it barely
moves with DAU — the driver is token creation rate, not users.

**The one thing that flips the NO-GO:** a sponsored or donated RPC plan (a
Business-tier key, ~100M credits/mo) or any real revenue line. That single
input takes fill-everything from ~$1k/month to ~$0 and makes the full scope a
GO with no other change in reasoning. Given the operator's ecosystem position,
this is a plausible ask, not a fantasy — but it is an ask, and it must land
_before_ the scope expands, not after.

---

## 1. Cost model (the deciding number)

Two inputs, both measured rather than assumed.

### 1a. Per-token fill cost — derived from Flurry's own code

One cold forensics fill for one pump.fun token, counted from the actual call
sites (`pumpfun/forensics.ts`, `pumpfun/lineage.ts`, `pumpfun/deployerHistory.ts`):

| Step                                           | Calls                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `fetchDeploySlotActivity` (sigLimit 50)        | 1 `getSignaturesForAddress` + N `getTransaction` (N = deploy-slot txs; ~1–20)          |
| `attachFundingLineage` (12 wallets, 1 hop)     | 12 × (1 `getSignaturesForAddress` + 1–10 `getTransaction`, early-exit on first funder) |
| `countDeployerPriorLaunches` (inspectLimit 40) | 1 `getSignaturesForAddress` + up to 40 `getTransaction` (**no** early exit)            |

**Typical ≈ 98 calls; worst case ≈ 224.** Helius bills both
`getTransaction` and `getSignaturesForAddress` at **1 credit** each, so
**~100 credits per cold token fill.** Use 100.

### 1b. Fill volume — measured live, 2026-08-26

Measured by subscribing to the pump.fun program over WebSocket and counting
create events with Flurry's own `CREATE_EVENT_DISCRIMINATOR` (90-second window,
public mainnet endpoint):

- **48 token creations/minute → ~69,100 new pump.fun tokens/day**
- 46,005 program log notifications in 90s → ~44M program txs/day (the firehose,
  for scale)

Robinhood Chain adds ~600 `TokenCreated`/day (README survey) — two orders of
magnitude smaller, and not the deciding factor. Solana sets the bill.

### 1c. The bill

**Fill everything (warm cache for the live feed):**

```
69,100 tokens/day × 100 credits = 6.9M credits/day = ~207M credits/month
```

Helius plans: Free 1M · Developer $49/10M · Business $499/100M · Professional
$999/200M. 207M/month **exceeds the top standard plan** — so the answer is
**$999/month plus autoscaling overage**, call it $1,000–1,100.

**Why this doesn't shrink with clever caching:** it is already the
fully-deduplicated number. 207M credits/month is the cost of filling each token
_exactly once, globally_. Without the cache, 1k users each auto-scanning their
feed would multiply it by ~1000; the cache is what makes it merely $1k/month
instead of catastrophic. The cache is working perfectly and still costs $1k.

**Fill a bounded curated set (recommended scope):**

```
200 tokens/day × 100 credits =  20k credits/day = 0.6M credits/month → FREE tier
500 tokens/day × 100 credits =  50k credits/day = 1.5M credits/month → $49/month
```

The recommended scope (graduation candidates, which are inherently few, plus a
few hundred trending) lands in the **free tier** at 200/day and the **$49
Developer tier** if it grows to 500/day. That is the whole cost argument: the
same architecture is free or a thousand dollars depending purely on how many
tokens you promise to cover.

### 1d. Serving cost

|                              | 1k DAU                                                   | 10k DAU                                       |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| **(b) static JSON on Pages** | **$0** (~30 GB/mo, egress free and unlimited)            | **$0** (~300 GB/mo)                           |
| **(a) Workers + KV**         | ~$5–10/mo (≈6M KV reads/mo, just over the ~3M free tier) | ~$50/mo (≈60M KV reads + 60M Worker requests) |

Serving is a rounding error either way. **Fill is the entire cost story.**

### 1e. Break-even

There is no revenue line to break even against. The tip jar is voluntary and
unforecastable; the Engine (`@flurry/forensics`) is deliberately an open
Apache-2.0 library with **no monetization hook by design** — that was the
explicit conclusion of ENGINE_DECISION.md. So:

> Any recurring cost here is an out-of-pocket subsidy by a single operator, with
> no mechanism that grows to cover it.

At $0/month (recommended scope) that is fine — it is free-tier usage of
infrastructure the project already has. At ~$1,000/month it is a salary-scale
commitment to a free product, which is a material input to the NO-GO.

---

## 2. Trust-model proof

### 2a. No key, no user data, no private compute enters the hosted layer

|                                         | Value                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Cache key                               | a chain address (mint) — public                                                                                                  |
| Cache value                             | a forensics conclusion (bundle verdict, cluster count, risk tier, local verdict) — a deterministic function of public chain data |
| Who computes                            | the operator's own scheduled job, with the operator's own RPC key, in CI                                                         |
| What the user's browser sends to get it | an HTTP GET for a static file — no body, no auth, no identifiers                                                                 |

This holds **structurally**, not by policy, because of a boundary that already
exists in the codebase: `@flurry/forensics` is pure — no network, no DOM, no
keys, no env access, enforced by a purity test in CI. The cache stores its
_outputs_. The user's own keys stay in the browser's memory and are never part
of any request to us; there is no request to us that could carry them (a static
file fetch has nowhere to put one).

**The line that must not be crossed:** if implementation ever needs the user's
RPC URL, an API key, a request body, a user identifier, or per-request compute,
the framing has collapsed from "CDN of public facts" to "we run a backend," and
per the brief that is an automatic NO-GO. Option (b) cannot cross that line
without changing architecture, which is a second reason to prefer it: the
guardrail is the shape of the thing, not a promise about the thing.

### 2b. Staleness honesty

Every cached conclusion ships with the slot/block it was computed at and is
rendered as `cached · as of slot N · Ns ago`, never as live. The existing
honesty law is unchanged: unknown still renders unknown, and a cached
conclusion whose inputs were truncated stays flagged truncated. A `RECOMPUTE`
action forces a fresh local computation against the user's own RPC, which is
the escape hatch that makes the cache advisory rather than authoritative.

### 2c. TTL by data type

The cacheability split lands exactly on the package boundary already shipped —
which is a good sign the boundary was drawn in the right place.

| Data                                        | Mutability                                                                             | TTL                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Deploy-slot bundle verdict                  | **immutable** once the slot is finalized (the deploy slot's contents can never change) | indefinite                                               |
| Funding lineage (1 hop, pre-deploy)         | immutable _for that deploy_                                                            | indefinite                                               |
| Deployer prior launches                     | monotonically grows                                                                    | 6–24 h, already flagged truncated/unverified             |
| Risk tier + local verdict                   | derived                                                                                | min(inputs) = the deployer-history TTL                   |
| **Curve progress %, mcap, vol/1h, holders** | **seconds-fresh**                                                                      | **DO NOT CACHE** — confirms the brief's suspicion        |
| RugCheck cross-check                        | third-party, user-keyed                                                                | never cached by us; it is the user's key and their quota |

So the cacheable half is precisely `@flurry/forensics` output, and the
non-cacheable half is precisely what the live providers fetch. The snapshot
carries forensics conclusions and deliberately carries **no market data** —
which also means a stale snapshot can never show a stale price, only a stale
(and immutable) verdict.

---

## 3. Architecture: option (b), and why not (a) or (c)

**Chosen: (b) precomputed static JSON snapshots**, regenerated on a schedule by
a GitHub Actions job using the operator's existing RPC key (a repo secret,
never in the client), committed/published as static files served by the same
Pages CDN that already serves the app.

The framing that makes this clean: **the snapshot is build output, not a
service.** The scheduled job is CI. The artifact is a file. The trust model is
identical to the trust model of shipping the app itself — you are already
trusting that CDN for the JavaScript that computes your verdicts locally.
There is no runtime component to attack, meter, or keep up.

**Why not (a) pure edge cache fronting an operator RPC:** it is a live service
with request-time behavior, which (i) reintroduces a backend in substance,
(ii) creates an unbounded cost-of-abuse surface (§5), and (iii) buys freshness
that §2c says the cacheable fields do not need — bundle verdicts are immutable,
so on-demand freshness is worth nothing for exactly the data being cached.
Option (a) pays real complexity for a property with no value here.

**Why not (c) community fill:** it fails on arithmetic before it fails on
trust. To trust a user-submitted conclusion you must recompute it; recomputing
costs the same ~100 credits as computing it yourself. So community fill
**saves nothing** while adding a poisoning surface and a verification protocol.
The only variant that works is submissions treated as _hints_ about what to
fill next — which is a ranking input, not a cache, and can be added later to
option (b) at zero risk.

**Honest limitation of (b), stated plainly:** it does **not** deliver the
brief's original promise. A visitor with no key still gets SLOW MODE (RHC) or
the demo feed (Solana) on the **live launch feed**, because a token that
launched three seconds ago cannot be in a snapshot regenerated every few
minutes — and covering it would require filling all 69k/day (§1c). What (b)
delivers is instant, real forensics on the **tokens a normie is actually most
likely to look up**: graduation candidates, trending tokens, and shared deep
links. That is a smaller, honest win, not the advertised one.

### Why the live feed is structurally the expensive case

Worth stating because it is the crux and it is not obvious from the brief:

1. Flurry's primary surface is a feed of tokens **seconds old**. A cache entry
   only helps viewer #2..N of a token.
2. For a three-second-old token, viewer #1 arrives essentially immediately — so
   a warm cache requires filling **ahead of demand**, and you cannot know which
   launches anyone will open.
3. Therefore warm-cache-for-the-feed ⟹ fill everything ⟹ §1c's $1k/month.
4. Compounding it: the app's background `ScanQueue` auto-scans **every** row
   that enters the feed, so the demand side is "all launches" by design, not
   "the ones users click." The cost is coupled to that auto-scan behavior as
   much as to the cache design.

The cache thesis ("popular tokens are scanned repeatedly, first scan serves the
next thousand") is sound — but it describes graduation candidates and shared
links, not a firehose of newborn tokens.

---

## 4. Brand + disclosure impact

Current line: **"Free forever. BYOK. Zero custody. No backend, no telemetry,
no token."**

Under option (b), the honest revision is a clause, not a rewrite:

> **Free forever. BYOK. Zero custody. No backend, no telemetry, no token — plus
> a public forensics snapshot, computed in CI from public chain data and served
> as static files. No keys, no accounts, no request-time compute, nothing about
> you. Recompute any of it against your own RPC.**

That is marginally longer and materially just as strong: "no backend" survives
because nothing serves user-specific computation; what is added is a published
artifact, in the same category as the app bundle. SECURITY.md gains one data-flow
line (`user browser ── GET static snapshot ──> our CDN (no key, no body, no
identifiers)`), and the snapshot's provenance (which RPC, which job, which
commit) is documented so the claim is auditable.

Under option (a) the honest line would have to become "we run a small cache
service," which **is** materially weaker — it concedes the founding claim to buy
a freshness property §2c shows is worthless for the cached fields. That
asymmetry is most of why (b) wins.

---

## 5. Failure + abuse modes

**Cache poisoning — can a rugger get a false LOW cached?**

- Operator-filled (a/b): the inputs are public chain data, so a false
  conclusion requires falsifying the chain. Not a realistic path.
- Community-filled (c): trivially yes, and unverifiable without recompute →
  **NO-GO for (c)** on exactly the ground the brief names.
- **Residual, and worth naming:** a _timing_ game. Fill at slot N, then
  bundle-buy at slot N+k. Bundle detection is deploy-slot-scoped **by
  definition**, so the cached conclusion is not false — but its risk implication
  goes stale. Mitigations: as-of-slot labels, TTL, `RECOMPUTE`, and never
  presenting a cached verdict as live. This is honesty-law work, not
  cryptography.
- **Trending-list gaming:** spam-creating tokens to occupy a "trending" list is
  cheap. Rank on realized liquidity/volume, never on creation recency or
  submission count.

**Cost-of-abuse — can someone run up the bill?**

- Option (a): **yes, badly.** Request-triggered fills mean an attacker requests
  a million random mints and each miss costs ~100 credits. Requires an
  allowlist (only mints from our own feed) plus per-IP limits — i.e. an abuse
  system, i.e. ops.
- Option (b): **structurally no.** Fills are schedule-triggered with a fixed
  per-run budget. An attacker cannot move the bill, only the reads, and reads
  are free and unlimited on Pages. The worst case is a fixed, known monthly
  number chosen in advance.

That difference — a bounded bill by construction versus a bill an adversary can
move — is the second decisive point for (b), alongside §4's brand asymmetry.

---

## 6. What ships from this document

Nothing. No code, no infra, no commitment. If the operator takes the GO on §3,
the next step is a separate implementation + security brief covering: the CI
fill job and its budget cap, the snapshot schema and as-of labeling, the UI
states for `cached`/`RECOMPUTE`, the SECURITY.md data-flow amendment, and the
ranking rules that resist §5's trending-list gaming.

If the operator wants the full-feed scope instead, the prerequisite is §0's flip
condition — a sponsored RPC plan or a revenue line — secured first.
