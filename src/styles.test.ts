import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Motion invariants, enforced on the stylesheet itself. The brief's rule is
 * that reduced motion gets instant state changes with no loss of information —
 * which is easy to honor when you add an animation and forget when you add the
 * next one. This test makes forgetting fail CI.
 */
const css = readFileSync(join(__dirname, "styles.css"), "utf8");

/** Extract the @media block by brace matching — comments and nested rules
 *  mean a naive close-brace search finds the wrong end. */
const reducedBlock = (() => {
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start, "reduced-motion block must exist").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unterminated @media block");
})();

/** Class selectors that declare an `animation:` shorthand. */
const animatedClasses = [...css.matchAll(/^\.([a-z-]+)\s*\{[^}]*?\banimation:/gms)].map(
  (m) => m[1],
);

describe("CRT motion", () => {
  it("finds the animated classes it expects to police", () => {
    expect(animatedClasses).toContain("crt");
    expect(animatedClasses).toContain("cursor");
    expect(animatedClasses).toContain("row-enter");
    expect(animatedClasses).toContain("resolve-flicker");
    expect(animatedClasses).toContain("scanlines-drift");
  });

  it.each(animatedClasses)("disables .%s under prefers-reduced-motion", (cls) => {
    expect(
      reducedBlock.includes(`.${cls}`),
      `.${cls} animates but is not disabled in the reduced-motion block`,
    ).toBe(true);
  });

  it("keeps the reduced-motion block ending in animation: none", () => {
    expect(reducedBlock).toMatch(/animation:\s*none/);
  });
});

describe("CRT intensity", () => {
  it("defaults to the pre-existing look on bare :root", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    expect(root).toContain("--crt-vignette: 0.55"); // the value shipped before this change
    expect(root).toContain("--crt-scanline: 0.22");
  });

  it('only intensifies behind an explicit data-crt="med" opt-in', () => {
    expect(css).toContain('[data-crt="med"]');
    const med = css.slice(css.indexOf('[data-crt="med"]'));
    expect(med).toMatch(/--crt-vignette:\s*0\.7/);
  });

  it("drives the scanline and vignette layers from those variables", () => {
    expect(css).toContain("var(--crt-scanline)");
    expect(css).toContain("var(--crt-vignette)");
  });
});
