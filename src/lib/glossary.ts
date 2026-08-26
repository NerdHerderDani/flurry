/**
 * One glossary map: term → one-sentence explanation. Register-neutral and
 * honest — no hype, no fear-mongering. Rendered by <Term> as tap/hover
 * expansions on the jargon in scanner + graduation. A render test asserts
 * every term used in UI copy exists here.
 */
export const GLOSSARY = {
  bundled:
    "Multiple wallets bought in the exact moment of launch, usually pre-arranged by the launcher to fake early demand.",
  "deploy slot":
    "The instant (Solana slot or EVM block) the token was created — buys landing in that same instant were queued before the public could react.",
  "funding lineage":
    "Where a wallet's money came from — wallets funded by the same source are likely controlled by the same person.",
  "linked wallets":
    "Buyer wallets that trace back to a common funding source, so they may not be independent buyers at all.",
  "dev holds":
    "The share of the token supply still in the deployer's own wallet — supply they can sell at any moment.",
  "bonding curve":
    "The launchpad's pricing mechanism: buys push the price up a preset curve until the token fills it and moves to an open market.",
  graduation:
    "The moment a token completes its bonding curve and moves to a regular trading pool — the launchpad phase is over.",
  mcap: "Market cap: the token's current price multiplied by its total supply — a size estimate, not money anyone actually paid.",
  "lp lock":
    "Liquidity-pool tokens locked away so the creator can't pull the trading pool out from under holders.",
  "insider network":
    "A group of wallets that RugCheck's graph analysis links together as likely coordinated insiders.",
  rugged:
    "The token's liquidity or value was already pulled out from under holders — the exit already happened.",
  "mint authority":
    "The right to create new tokens at will; if nobody holds it, the supply can never be inflated.",
  unverified:
    "This field can't be checked from raw chain data with your current setup, so flurry shows it as unknown instead of guessing.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
