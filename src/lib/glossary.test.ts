import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "./glossary";

/** Every term the UI references via <Term term="…"> must exist in the map. */
function collectTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collectTsxFiles(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("glossary coverage", () => {
  it("every <Term term=…> used in UI copy exists in the glossary map", () => {
    const files = collectTsxFiles(join(__dirname, ".."));
    const used = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/<Term\s+term="([^"]+)"/g)) {
        const term = m[1];
        if (term) used.add(term);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const term of used) {
      expect(GLOSSARY, `missing glossary entry: "${term}"`).toHaveProperty(term);
    }
  });

  it("covers the brief's minimum term list", () => {
    for (const term of [
      "bundled",
      "deploy slot",
      "funding lineage",
      "linked wallets",
      "dev holds",
      "bonding curve",
      "graduation",
      "mcap",
      "lp lock",
      "insider network",
      "rugged",
      "mint authority",
    ]) {
      expect(GLOSSARY).toHaveProperty(term);
    }
  });

  it("explanations are one sentence, register-neutral", () => {
    for (const [term, text] of Object.entries(GLOSSARY)) {
      expect(text.length, term).toBeGreaterThan(20);
      expect(text.length, term).toBeLessThan(220);
      expect(/!{2,}|🚀|💎|moon|scam alert/i.test(text), `${term} reads as hype/fear`).toBe(false);
    }
  });
});
