# Contributing

## Setup

```sh
npm install
npm run dev
```

## The gates (CI enforces all of these)

```sh
npm run lint        # eslint, zero warnings tolerated in CI
npm run typecheck   # tsc strict — the config is strict on purpose, don't loosen it
npm test            # vitest — forensics heuristics must stay covered
npm run format:check
npm run build
```

## Architecture rules

1. **ChainProvider is the seam.** UI components consume the `ChainProvider` interface only.
   New data sources (pump.fun RPC, other platforms) implement the interface; the UI does not change.
2. **Forensics is pure.** Everything in `src/lib/forensics/` is deterministic functions with unit
   tests. Heuristic threshold changes require test updates in the same PR.
3. **Zod at every boundary.** External data (RPC responses, AI responses) is parsed before it
   enters app state.
4. **Keys never persist.** See SECURITY.md. Non-negotiable.
5. **No Jito-ecosystem assets in v0 coverage.**

## Style

Prettier owns formatting. Strong opinions live in code review, not in whitespace.
