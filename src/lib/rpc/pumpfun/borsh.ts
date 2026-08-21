import { PublicKey } from "@solana/web3.js";

/** Decodes base64 into bytes without a Buffer polyfill (atob is a browser + Node 16+ global). */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Sequential little-endian reader over the fixed borsh layouts pump.fun emits. */
export class BorshReader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}

  get bytesRemaining(): number {
    return this.bytes.length - this.offset;
  }

  private take(n: number): Uint8Array {
    const slice = this.bytes.subarray(this.offset, this.offset + n);
    if (slice.length < n) throw new Error(`borsh: expected ${n} bytes, got ${slice.length}`);
    this.offset += n;
    return slice;
  }

  u8(): number {
    return this.take(1)[0] as number;
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  u64(): bigint {
    const b = this.take(8);
    let v = 0n;
    for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[i] as number);
    return v;
  }

  i64(): bigint {
    const unsigned = this.u64();
    return unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned;
  }

  pubkey(): string {
    return new PublicKey(this.take(32)).toBase58();
  }

  string(): string {
    const len = this.take(4);
    const n =
      (len[0] as number) |
      ((len[1] as number) << 8) |
      ((len[2] as number) << 16) |
      ((len[3] as number) << 24);
    return new TextDecoder().decode(this.take(n));
  }

  discriminator(): number[] {
    return Array.from(this.take(8));
  }
}

export function discriminatorMatches(actual: number[], expected: readonly number[]): boolean {
  return actual.length === expected.length && actual.every((b, i) => b === expected[i]);
}
