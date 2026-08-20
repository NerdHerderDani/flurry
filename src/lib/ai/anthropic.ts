import { z } from "zod";
import type { DossierEvidence } from "../schemas";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const MessagesResponse = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

const PROMPT_HEADER =
  "You are a Solana token-launch forensics analyst writing terminal output. " +
  "Given this on-chain evidence, write a dossier verdict in EXACTLY this format, plain text, max 90 words total:\n" +
  "VERDICT: <AVOID | CAUTION | CLEAR>\n" +
  "CONFIDENCE: <LOW | MED | HIGH>\n" +
  "READ: <2-3 blunt sentences interpreting the evidence: bundling, wallet clustering, deployer history. No hedging filler. No markdown.>\n\n" +
  "Evidence JSON:\n";

/**
 * BYOK dossier call. The key lives in memory only and goes straight to
 * Anthropic from the user's browser — this app never proxies or stores it.
 */
export async function runDossier(evidence: DossierEvidence, apiKey: string): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // required for direct browser calls; acceptable here because the key is the user's own
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: PROMPT_HEADER + JSON.stringify(evidence) }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 200)}`);
  }
  const parsed = MessagesResponse.parse(await res.json());
  const text = parsed.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Empty dossier response");
  return text;
}
