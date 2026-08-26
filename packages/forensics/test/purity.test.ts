import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };

/**
 * The package's headline promise is that it's pure: no React, no DOM, no
 * network, no keys, nothing environment-bound. That promise is what makes it
 * safe to embed in someone else's backend, so it's a test, not a README claim.
 */
const SRC = join(__dirname, "..", "src");
const sourceFiles = readdirSync(SRC).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("@flurry/forensics purity invariants", () => {
  it("has exactly one runtime dependency (zod)", () => {
    expect(Object.keys(pkg.dependencies)).toEqual(["zod"]);
  });

  it("imports nothing but relative modules and zod", () => {
    for (const file of sourceFiles) {
      const src = readFileSync(join(SRC, file), "utf8");
      for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
        const spec = m[1];
        if (!spec) continue;
        const ok = spec.startsWith("./") || spec.startsWith("../") || spec === "zod";
        expect(ok, `${file} imports "${spec}"`).toBe(true);
      }
    }
  });

  it("touches no browser, network, or environment API", () => {
    // Matches real usage (document./window./fetch(), etc.), not prose in comments.
    const banned = [
      /\bdocument\s*\./,
      /\bwindow\s*\./,
      /\bfetch\s*\(/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\bprocess\s*\.\s*env\b/,
      /from\s+"react/,
    ];
    for (const file of sourceFiles) {
      const src = readFileSync(join(SRC, file), "utf8");
      for (const pattern of banned) {
        expect(pattern.test(src), `${file} matches ${pattern}`).toBe(false);
      }
    }
  });
});
