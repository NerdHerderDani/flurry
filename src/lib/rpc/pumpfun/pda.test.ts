import { describe, expect, it } from "vitest";
import { deriveBondingCurvePda, deriveGlobalPda, isValidMintAddress } from "./pda";

describe("PDA derivation", () => {
  // Verified 2026-08-20 against a live create_v2 transaction — see DECODING.md.
  it("derives the bonding-curve PDA matching a real create_v2 tx", () => {
    expect(deriveBondingCurvePda("9dtmpyqK6gokJLVWrqPnhw6bq1kXGDJsuCoMtWQUpump")).toBe(
      "Dan7TVQLS8qS2BBt5z5bm7r9FKf149Xs33XACfUP6UPX",
    );
  });

  it("derives the global PDA matching the live account", () => {
    expect(deriveGlobalPda()).toBe("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
  });
});

describe("isValidMintAddress", () => {
  it("accepts a real base58 pubkey", () => {
    expect(isValidMintAddress("9dtmpyqK6gokJLVWrqPnhw6bq1kXGDJsuCoMtWQUpump")).toBe(true);
  });

  it("rejects garbage input", () => {
    expect(isValidMintAddress("not a mint")).toBe(false);
    expect(isValidMintAddress("")).toBe(false);
  });
});
