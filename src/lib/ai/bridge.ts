import { z } from "zod";
import type { DossierEvidence } from "../schemas";

const HealthResponse = z.object({
  ok: z.boolean(),
  backend: z.enum(["claude-cli", "api-key", "none"]),
  version: z.string(),
});
export type HealthResult = z.infer<typeof HealthResponse>;

const DossierResponse = z.object({ dossier: z.string() });

function bridgeUrl(port: number, path: string): string {
  return `http://localhost:${port}${path}`;
}

/** Thrown specifically for the bridge's 503 "reachable but no backend configured" response. */
export class BridgeNoBackendError extends Error {}

/** Polled by the Config tab every 5s to show live BRIDGE: CONNECTED / NOT FOUND status. */
export async function checkBridge(port: number): Promise<HealthResult> {
  const res = await fetch(bridgeUrl(port, "/v1/health"));
  if (!res.ok) throw new Error(`bridge health check failed: HTTP ${res.status}`);
  return HealthResponse.parse(await res.json());
}

/**
 * DESKTOP BRIDGE dossier call. Only the fixed DossierEvidence shape ever
 * leaves the browser — the bridge builds the prompt itself server-side.
 */
export async function runDossierViaBridge(
  evidence: DossierEvidence,
  port: number,
): Promise<string> {
  const res = await fetch(bridgeUrl(port, "/v1/dossier"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evidence),
  });
  if (res.status === 503) {
    const detail = (await res.json().catch(() => null)) as { hint?: string } | null;
    throw new BridgeNoBackendError(detail?.hint ?? "bridge has no backend configured");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`bridge dossier call failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  return DossierResponse.parse(await res.json()).dossier;
}
