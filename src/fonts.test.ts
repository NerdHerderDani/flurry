import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A5's whole point is that the display kanji stop falling back to a system
 * font. That failed once during implementation — the subset for 慌 was chosen
 * from a wrong code point (U+6172 instead of U+614C), so the glyph silently
 * kept rendering in the fallback and only a network-request check caught it.
 * These tests make that failure mode loud.
 */
const ROOT = join(__dirname, "..");
const css = readFileSync(join(ROOT, "src/fonts.css"), "utf8");

/** Every glyph that must render in the pixel display face. */
const DISPLAY_GLYPHS = ["慌", "霜"];

function parseRanges(block: string): Set<number> {
  const ur = /unicode-range:\s*([^;]+);/.exec(block);
  const cps = new Set<number>();
  if (!ur?.[1]) return cps;
  for (const raw of ur[1].split(",")) {
    const part = raw.trim().replace(/^U\+/i, "");
    if (part.includes("-")) {
      const [a, z] = part.split("-");
      if (!a || !z) continue;
      for (let c = parseInt(a, 16); c <= parseInt(z, 16); c++) cps.add(c);
    } else if (part) {
      cps.add(parseInt(part, 16));
    }
  }
  return cps;
}

const blocks = css.split("@font-face").slice(1);

describe("DotGothic16 self-hosted subsets", () => {
  it("declares at least the latin block plus one per display glyph", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(1 + DISPLAY_GLYPHS.length);
  });

  it.each(DISPLAY_GLYPHS)("covers %s with a declared unicode-range", (glyph) => {
    const cp = glyph.codePointAt(0);
    expect(cp).toBeDefined();
    const covered = blocks.some((b) => parseRanges(b).has(cp as number));
    expect(
      covered,
      `${glyph} (U+${cp?.toString(16).toUpperCase()}) is in no declared unicode-range — it will silently fall back to a system font`,
    ).toBe(true);
  });

  it("every referenced woff2 file actually exists in public/fonts", () => {
    const refs = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref, "font URLs must be root-relative so no CDN is involved").toMatch(/^\/fonts\//);
      expect(existsSync(join(ROOT, "public", ref!)), `missing ${ref}`).toBe(true);
    }
  });

  it("ships no font file the CSS doesn't reference (no dead 2 MB blobs)", () => {
    const onDisk = readdirSync(join(ROOT, "public/fonts")).filter((f) => f.endsWith(".woff2"));
    for (const file of onDisk) {
      expect(css, `${file} is on disk but unreferenced`).toContain(file);
    }
  });

  it("loads no font from a third-party origin", () => {
    expect(css).not.toMatch(/https?:\/\//);
  });
});
