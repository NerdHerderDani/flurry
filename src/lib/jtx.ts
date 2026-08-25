/**
 * JTX referral integration (operator-provided referral code, 2026-08-24).
 *
 * Verified 2026-08-24:
 * - https://jtx.com/ref/lucipher → 301 → https://app.jtx.com/ref/lucipher (HTTP 200);
 *   /ref/[code] is a first-class route in the app's build manifest.
 * - Token deep links: JTX has no per-token path route; the canonical token URL is
 *   https://app.jtx.com/?mint=<mint> (confirmed via the app's own /token-og/[slug]
 *   canonical + og:url tags, which 404 on invalid mints).
 * - The referral share is 20% of the referred user's trading fees, per jtx.com
 *   ("Refer a trader. Earn 20%. Forever.").
 *
 * The ref param on the deep link is best-effort: attribution's designed entry point
 * is the /ref/<code> route, so the deep link may or may not credit the referral —
 * it loads the token's market either way.
 */
export const JTX_REFERRAL_CODE = "lucipher";
export const JTX_REFERRAL_URL = `https://jtx.com/ref/${JTX_REFERRAL_CODE}`;

export function jtxTokenUrl(mint: string): string {
  return `https://app.jtx.com/?mint=${encodeURIComponent(mint)}&ref=${JTX_REFERRAL_CODE}`;
}
