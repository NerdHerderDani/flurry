# ENGINE_DECISION.md — the architecture fork

Decision: **Option 3 — ship the npm library now (`@flurry/forensics`), document
the hosted API as an explicitly-deferred business decision.** The operator's
lean and the brief's recommendation, but arrived at from the tradeoffs below,
not adopted from them. Also decided here: **monorepo, not sibling repo.**

## Why the library wins on the merits

**1. The audience already runs infrastructure.** The named consumers — wallets,
bots, launchpads, terminals — all operate backends and RPC relationships
already. For them, `npm install` is _less_ integration friction than an API
key: no network hop in their hot path, no rate-limit coupling to someone
else's tier, no new external dependency in their uptime story. A hosted API
serves people who _can't_ run code; that is not this audience.

**2. A hosted API has a value problem the brief doesn't price in.** The engine
is pure functions over _evidence_ the caller supplies. A hosted API either
(a) accepts evidence JSON and returns a verdict — a network call wrapping
~1ms of arithmetic, negative value to anyone with a backend — or (b) fetches
the chain data itself, which means operating RPC infrastructure, paying for
it per request, and managing keys/abuse. Option (b) is the real product
RugCheck sells, and it is a company, not a feature. That fork alone justifies
deferring: we don't yet know which hosted shape anyone wants.

**3. Liability and brand are load-bearing, not vibes.** Flurry's stated model
is "no backend, your keys, your machine" — SECURITY.md's one-line data flow
is the security model. A hosted verdict endpoint makes the operator the
service-of-record for financial-adjacent risk assessments, with an implicit
SLA on heuristic quality, abuse handling, and uptime — run by a disclosed
Jito Labs employee as a side project. That is a real commitment to make
deliberately, not under launch momentum.

**4. The library forecloses nothing and feeds the later decision.** The hosted
API, if it ever exists, wraps this exact package (it is the reference
implementation by construction). Meanwhile npm downloads, issues, and
provider-authoring questions are the demand signal. Weak signal, but free —
and strictly more information than deciding today with none.

**5. Positioning: open beats keyed.** Against RugCheck's "plug in our risk
engine" pitch, "the forensics is open — run it yourself, or embed it" is the
answer only Flurry can give and RugCheck (a paid API) structurally cannot.
Option 2 would surrender that asymmetry to compete on their terms, with their
cost structure, without their head start.

**Why not option 1 (library only, no API doc)?** Materially the same work; the
only difference is writing down the hosted possibility. Writing it down is
worth it: it tells integrators the library is the _reference implementation_
of something intended to be stable, and it pre-frames the API as "wraps the
same package" so nobody expects a divergent hosted engine. The one risk —
creating an expectation — is handled by explicit language in ENGINE.md:
possible future, not a commitment.

**What would change the answer:** evidence that the target integrators can't
or won't run the package (e.g. no-code bot platforms dominating demand), or a
funding/ownership structure that wants the usage visibility and monetization
of a keyed API and can pay its ops bill. Neither exists today.

## Monorepo, not sibling repo

The regression proof is the whole game: the Flurry app must consume the
extracted package with zero behavior change. In a monorepo (npm workspaces),
extraction and consumption are **one atomic PR** — the same commit that moves
the code rewires the app, and one CI run gates both. A sibling repo makes the
proof cross-repo: publish-or-link plumbing, version lag, two PRs that can
drift, and a window where app and package copies diverge silently. The
monorepo costs a workspaces stanza and a CI step; the sibling costs the
guarantee this brief is built on. Monorepo. (A future hosted API — a separate
deployable with its own security model — would be the thing that justifies a
sibling repo, per the brief's own framing.)

## Consequences

- `packages/forensics` = `@flurry/forensics` 0.1.0: pure functions, schema
  contract, `ChainProvider` interface, demo provider. Zero runtime deps
  beyond zod. ESM + types. Live providers stay in the app.
- The app's `src/lib/forensics/*` and schema/provider modules become imports
  of the package — the app is consumer #1 and the regression proof.
- Publish is dry-run only in the PR; the real `npm publish` is an operator
  action after review.
- ENGINE.md documents the public surface, the honesty invariants as API
  guarantees, the provider-authoring guide, and the hosted API as a
  deliberately-deferred option that would wrap this package.
