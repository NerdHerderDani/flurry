import { decodeFunctionResult, encodeFunctionData } from "viem";
import { ERC20_READ_ABI } from "./abi";
import type { RpcCaller } from "../transport";

/**
 * name()/symbol() via eth_call — no event carries them (see DECODING.md), and
 * these are the only two fields the app actually needs from the token itself.
 */
export async function readErc20NameSymbol(
  transport: RpcCaller,
  tokenAddress: string,
): Promise<{ name: string; symbol: string }> {
  const [name, symbol] = await Promise.all([
    readErc20String(transport, tokenAddress, "name"),
    readErc20String(transport, tokenAddress, "symbol"),
  ]);
  return { name, symbol };
}

async function readErc20String(
  transport: RpcCaller,
  tokenAddress: string,
  functionName: "name" | "symbol",
): Promise<string> {
  const data = encodeFunctionData({ abi: ERC20_READ_ABI, functionName });
  const result = await transport.call<string>("eth_call", [{ to: tokenAddress, data }, "latest"]);
  return decodeFunctionResult({
    abi: ERC20_READ_ABI,
    functionName,
    data: result as `0x${string}`,
  });
}
