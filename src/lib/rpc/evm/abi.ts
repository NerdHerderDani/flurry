/**
 * pools.trade (Uniswap Labs) on Robinhood Chain. Addresses and event ABIs
 * verified 2026-08-24 against Blockscout's verified source and live
 * transactions — see DECODING.md. All lowercase for case-insensitive compares.
 */
export const UERC20_FACTORY_ADDRESS = "0x000000e200088d55c39a11f609e5f667729ad49b";
export const LIQUIDITY_LAUNCHER_ADDRESS = "0x0000ffffbe8efe702c8703ae3477ff5de3d319c0";
export const INSTANT_LAUNCH_STRATEGY_ADDRESS = "0x23f8209572b4a1c2ad88a42749e830791fb027f1";
export const POOL_MANAGER_ADDRESS = "0x8366a39cc670b4001a1121b8f6a443a643e40951";

export const ROBINHOOD_CHAIN_ID = 4663;

export const UERC20_METADATA_TUPLE = [
  { name: "description", type: "string" },
  { name: "website", type: "string" },
  { name: "image", type: "string" },
  { name: "extraData", type: "bytes" },
] as const;

export const TOKEN_CREATED_EVENT = {
  type: "event",
  name: "TokenCreated",
  anonymous: false,
  inputs: [
    { indexed: false, name: "tokenAddress", type: "address" },
    { indexed: false, name: "metadata", type: "tuple", components: UERC20_METADATA_TUPLE },
  ],
} as const;

export const DISTRIBUTION_INITIALIZED_EVENT = {
  type: "event",
  name: "DistributionInitialized",
  anonymous: false,
  inputs: [
    { indexed: true, name: "distributor", type: "address" },
    { indexed: true, name: "token", type: "address" },
    { indexed: false, name: "totalSupply", type: "uint256" },
  ],
} as const;

const POOL_KEY_TUPLE = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

export const TOKEN_LAUNCHED_EVENT = {
  type: "event",
  name: "TokenLaunched",
  anonymous: false,
  inputs: [
    { indexed: true, name: "poolId", type: "bytes32" },
    { indexed: true, name: "token", type: "address" },
    { indexed: true, name: "finalPositionRecipient", type: "address" },
    { indexed: false, name: "key", type: "tuple", components: POOL_KEY_TUPLE },
  ],
} as const;

export const POOL_SWAP_EVENT = {
  type: "event",
  name: "Swap",
  anonymous: false,
  inputs: [
    { indexed: true, name: "id", type: "bytes32" },
    { indexed: true, name: "sender", type: "address" },
    { indexed: false, name: "amount0", type: "int128" },
    { indexed: false, name: "amount1", type: "int128" },
    { indexed: false, name: "sqrtPriceX96", type: "uint160" },
    { indexed: false, name: "liquidity", type: "uint128" },
    { indexed: false, name: "tick", type: "int24" },
    { indexed: false, name: "fee", type: "uint24" },
  ],
} as const;

export const ERC20_TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  anonymous: false,
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const;

export const ERC20_READ_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
