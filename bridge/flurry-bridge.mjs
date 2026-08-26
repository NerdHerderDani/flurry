#!/usr/bin/env node
// flurry-bridge — single-file, zero-npm-dependency local server for FLURRY's
// DESKTOP BRIDGE mode. Routes dossier requests to a local `claude` CLI
// (subscription-powered, no API billing) or, if that's unavailable, to
// api.anthropic.com using an ANTHROPIC_API_KEY from the shell environment.
// The Anthropic key never enters the browser either way.
//
// Run:   node flurry-bridge.mjs
// Env:   FLURRY_BRIDGE_PORT   — port to listen on (default 4114)
//        ANTHROPIC_API_KEY    — fallback backend if the claude CLI isn't on PATH
//        FLURRY_BRIDGE_CMD    — override the CLI command (test hook)
//
// See BRIDGE_NOTES.md for the verified claude CLI output shape and the
// Private Network Access (PNA) header requirement this implements.

import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";

export const BRIDGE_VERSION = "0.1.0";
export const DEFAULT_PORT = 4114;
export const ALLOWED_ORIGINS = [
  "https://nerdherderdani.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];
const RATE_LIMIT_PER_MIN = 10;
const CLI_TIMEOUT_MS = 60_000;
const MAX_BODY_BYTES = 16 * 1024;

// ---------------------------------------------------------------------------
// Prompt template — KEEP IN SYNC with src/lib/ai/prompt.ts. This file is a
// standalone zero-dependency script and can't import across the src/
// boundary, so the template is duplicated here verbatim.
// ---------------------------------------------------------------------------
const PROMPT_HEADER =
  "You are a Solana token-launch forensics analyst writing terminal output. " +
  "Given this on-chain evidence, write a dossier verdict in EXACTLY this format, plain text, max 90 words total:\n" +
  "VERDICT: <AVOID | CAUTION | CLEAR>\n" +
  "CONFIDENCE: <LOW | MED | HIGH>\n" +
  "READ: <2-3 blunt sentences interpreting the evidence: bundling, wallet clustering, deployer history. No hedging filler. No markdown.>\n\n" +
  "If a `rugcheck` section is present it is third-party data from rugcheck.xyz — weigh it as a second opinion against the on-chain evidence, never as ground truth.\n\n" +
  "Evidence JSON:\n";

/**
 * The injection wall: this is the ONLY function that builds a prompt, and it
 * only ever consumes the fixed, validated DossierEvidence shape below — never
 * a raw string from the request body. A hostile page reaching this port can
 * get a token verdict; it cannot get arbitrary Claude access.
 */
export function buildDossierPrompt(evidence) {
  return PROMPT_HEADER + JSON.stringify(evidence);
}

// ---------------------------------------------------------------------------
// Evidence validation — mirrors DossierEvidence in src/lib/schemas.ts field
// for field. No zod here by design (zero dependencies), so every field is
// checked by hand: type, range, and a string length cap the browser schema
// doesn't itself enforce (this boundary is more hostile than the app's own).
// ---------------------------------------------------------------------------
const STRING_FIELD_MAX_LEN = { ticker: 32, platformLabel: 64, deployer: 64 };
const INT_FIELD_MAX = 1_000_000;
const VALID_CHAINS = ["solana", "robinhood"];
const EVIDENCE_FIELDS = [
  "chain",
  "ticker",
  "platformLabel",
  "deployer",
  "bundled",
  "bundleWallets",
  "firstBlockSupplyPct",
  "linkedWallets",
  "deployerPriorLaunches",
  "deployerPriorRugs",
  "devHoldsPct",
  "rugcheck",
];

// Optional third-party cross-check section. Same wall as everything else, and
// deliberately stricter than it looks: numbers and booleans only, plus one
// fixed source literal — a free-text string can NEVER enter through here.
const RUGCHECK_FIELDS = [
  "source",
  "rugged",
  "riskScoreNormalised",
  "riskCount",
  "dangerRisks",
  "warnRisks",
  "lpLockedPct",
  "insiderNetworkCount",
  "insiderNetworkMaxSize",
];

function validateRugcheckSection(rc) {
  if (typeof rc !== "object" || rc === null || Array.isArray(rc)) {
    return { ok: false, error: "rugcheck must be a JSON object" };
  }
  const unexpected = Object.keys(rc).filter((k) => !RUGCHECK_FIELDS.includes(k));
  if (unexpected.length > 0) {
    return { ok: false, error: `rugcheck: unexpected field(s): ${unexpected.join(", ")}` };
  }
  if (rc.source !== "rugcheck.xyz") {
    return { ok: false, error: 'rugcheck.source must be exactly "rugcheck.xyz"' };
  }
  if (typeof rc.rugged !== "boolean") {
    return { ok: false, error: "rugcheck.rugged must be a boolean" };
  }
  for (const key of [
    "riskScoreNormalised",
    "riskCount",
    "dangerRisks",
    "warnRisks",
    "insiderNetworkCount",
    "insiderNetworkMaxSize",
  ]) {
    const v = rc[key];
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0 || v > INT_FIELD_MAX) {
      return {
        ok: false,
        error: `rugcheck.${key} must be an integer between 0 and ${INT_FIELD_MAX}`,
      };
    }
  }
  if (rc.riskScoreNormalised > 100) {
    return { ok: false, error: "rugcheck.riskScoreNormalised must be at most 100" };
  }
  if (
    rc.lpLockedPct !== null &&
    (!isFiniteNumber(rc.lpLockedPct) || rc.lpLockedPct < 0 || rc.lpLockedPct > 100)
  ) {
    return { ok: false, error: "rugcheck.lpLockedPct must be null or a number between 0 and 100" };
  }
  return {
    ok: true,
    section: {
      source: rc.source,
      rugged: rc.rugged,
      riskScoreNormalised: rc.riskScoreNormalised,
      riskCount: rc.riskCount,
      dangerRisks: rc.dangerRisks,
      warnRisks: rc.warnRisks,
      lpLockedPct: rc.lpLockedPct,
      insiderNetworkCount: rc.insiderNetworkCount,
      insiderNetworkMaxSize: rc.insiderNetworkMaxSize,
    },
  };
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateDossierEvidence(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const unexpected = Object.keys(body).filter((k) => !EVIDENCE_FIELDS.includes(k));
  if (unexpected.length > 0) {
    return { ok: false, error: `unexpected field(s): ${unexpected.join(", ")}` };
  }

  if (!VALID_CHAINS.includes(body.chain)) {
    return { ok: false, error: `chain must be one of: ${VALID_CHAINS.join(", ")}` };
  }

  for (const key of ["ticker", "platformLabel", "deployer"]) {
    const v = body[key];
    const maxLen = STRING_FIELD_MAX_LEN[key];
    if (typeof v !== "string" || v.length === 0 || v.length > maxLen) {
      return { ok: false, error: `${key} must be a non-empty string of at most ${maxLen} chars` };
    }
  }

  if (typeof body.bundled !== "boolean") {
    return { ok: false, error: "bundled must be a boolean" };
  }

  for (const key of [
    "bundleWallets",
    "linkedWallets",
    "deployerPriorLaunches",
    "deployerPriorRugs",
  ]) {
    const v = body[key];
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0 || v > INT_FIELD_MAX) {
      return { ok: false, error: `${key} must be an integer between 0 and ${INT_FIELD_MAX}` };
    }
  }

  for (const key of ["firstBlockSupplyPct", "devHoldsPct"]) {
    const v = body[key];
    if (!isFiniteNumber(v) || v < 0 || v > 100) {
      return { ok: false, error: `${key} must be a number between 0 and 100` };
    }
  }

  let rugcheckSection;
  if (body.rugcheck !== undefined) {
    const rc = validateRugcheckSection(body.rugcheck);
    if (!rc.ok) return { ok: false, error: rc.error };
    rugcheckSection = rc.section;
  }

  return {
    ok: true,
    evidence: {
      chain: body.chain,
      ticker: body.ticker,
      platformLabel: body.platformLabel,
      deployer: body.deployer,
      bundled: body.bundled,
      bundleWallets: body.bundleWallets,
      firstBlockSupplyPct: body.firstBlockSupplyPct,
      linkedWallets: body.linkedWallets,
      deployerPriorLaunches: body.deployerPriorLaunches,
      deployerPriorRugs: body.deployerPriorRugs,
      devHoldsPct: body.devHoldsPct,
      ...(rugcheckSection !== undefined && { rugcheck: rugcheckSection }),
    },
  };
}

// ---------------------------------------------------------------------------
// CORS / origin allowlist
// ---------------------------------------------------------------------------
export function isOriginAllowed(origin, allowedOrigins = ALLOWED_ORIGINS) {
  return allowedOrigins.includes(origin);
}

// ---------------------------------------------------------------------------
// Backend resolution — claude CLI on PATH (subscription, preferred), else
// ANTHROPIC_API_KEY in this shell's env, else none.
// ---------------------------------------------------------------------------
export function detectClaudeCli(cliCommand) {
  const res = spawnSync(cliCommand, ["--version"], { timeout: 5000 });
  return !(res.error && res.error.code === "ENOENT");
}

export function resolveBackend(options = {}) {
  const cliCommand = options.cliCommand ?? process.env.FLURRY_BRIDGE_CMD ?? "claude";
  if (detectClaudeCli(cliCommand)) return { backend: "claude-cli", cliCommand };
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (apiKey) return { backend: "api-key", apiKey };
  return { backend: "none" };
}

// ---------------------------------------------------------------------------
// Rate limiting — one in-memory counter, 10/min by default.
// ---------------------------------------------------------------------------
export function createRateLimiter(limitPerMin = RATE_LIMIT_PER_MIN, now = () => Date.now()) {
  const timestamps = [];
  return function tryConsume() {
    const cutoff = now() - 60_000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift();
    if (timestamps.length >= limitPerMin) return false;
    timestamps.push(now());
    return true;
  };
}

// ---------------------------------------------------------------------------
// Backend invocation
// ---------------------------------------------------------------------------
export class BridgeTimeoutError extends Error {}

function runClaudeCli(cliCommand, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cliCommand, ["-p", prompt, "--output-format", "json", "--tools", ""], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      reject(new BridgeTimeoutError("claude CLI timed out"));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(new Error(`claude CLI produced unparseable output (exit ${code})`));
        return;
      }
      if (parsed.is_error || code !== 0) {
        reject(
          new Error(
            typeof parsed.result === "string" ? parsed.result : `claude CLI exited ${code}`,
          ),
        );
        return;
      }
      resolve(typeof parsed.result === "string" ? parsed.result : "");
    });
  });
}

async function runApiKey(apiKey, prompt, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const json = await res.json();
    const text = (json.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("empty response from Anthropic API");
    return text;
  } catch (err) {
    if (err.name === "AbortError") throw new BridgeTimeoutError("Anthropic API call timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

/** No evidence, verdicts, or prompt content ever reach the logs — method/path/status/timing only. */
function logStatus(method, path, status, startedAt) {
  console.log(`${method} ${path} ${status} ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

async function handleDossier(req, res, resolved, opts, startedAt) {
  if (!opts.tryConsumeRateLimit()) {
    sendJson(res, 429, { error: "rate limit exceeded — 10 dossiers/min, try again shortly" });
    logStatus("POST", "/v1/dossier", 429, startedAt);
    return;
  }

  let raw;
  try {
    raw = await readBody(req, MAX_BODY_BYTES);
  } catch {
    sendJson(res, 413, { error: "body too large" });
    logStatus("POST", "/v1/dossier", 413, startedAt);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    logStatus("POST", "/v1/dossier", 400, startedAt);
    return;
  }

  const validation = validateDossierEvidence(parsed);
  if (!validation.ok) {
    sendJson(res, 400, { error: validation.error });
    logStatus("POST", "/v1/dossier", 400, startedAt);
    return;
  }

  if (resolved.backend === "none") {
    sendJson(res, 503, {
      error: "no backend available",
      hint: "install the claude CLI (https://claude.com/claude-code) or set ANTHROPIC_API_KEY in the shell running this bridge, then restart it",
    });
    logStatus("POST", "/v1/dossier", 503, startedAt);
    return;
  }

  const prompt = buildDossierPrompt(validation.evidence);
  try {
    const dossier =
      resolved.backend === "claude-cli"
        ? await runClaudeCli(resolved.cliCommand, prompt, opts.timeoutMs)
        : await runApiKey(resolved.apiKey, prompt, opts.timeoutMs);
    sendJson(res, 200, { dossier });
    logStatus("POST", "/v1/dossier", 200, startedAt);
  } catch (err) {
    if (err instanceof BridgeTimeoutError) {
      sendJson(res, 504, { error: "backend timed out" });
      logStatus("POST", "/v1/dossier", 504, startedAt);
      return;
    }
    sendJson(res, 502, { error: "backend error" });
    logStatus("POST", "/v1/dossier", 502, startedAt);
  }
}

/**
 * Builds (but does not start) the bridge server. Callers pick the port via
 * server.listen(port) — main() uses FLURRY_BRIDGE_PORT, tests use 0 (ephemeral).
 */
export function createBridgeServer(options = {}) {
  const allowedOrigins = options.allowedOrigins ?? ALLOWED_ORIGINS;
  const timeoutMs = options.timeoutMs ?? CLI_TIMEOUT_MS;
  const resolved = resolveBackend(options);
  const tryConsumeRateLimit = createRateLimiter(options.rateLimitPerMin ?? RATE_LIMIT_PER_MIN);

  const server = createServer((req, res) => {
    const startedAt = Date.now();
    const origin = req.headers.origin;

    if (origin !== undefined && !isOriginAllowed(origin, allowedOrigins)) {
      res.writeHead(403).end();
      return;
    }
    if (origin !== undefined) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      // Required on current Chrome (PNA fully enforced since Chrome 142) — see BRIDGE_NOTES.md.
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.writeHead(204).end();
      return;
    }

    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/v1/health") {
      sendJson(res, 200, {
        ok: resolved.backend !== "none",
        backend: resolved.backend,
        version: BRIDGE_VERSION,
      });
      logStatus("GET", "/v1/health", 200, startedAt);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/dossier") {
      void handleDossier(req, res, resolved, { timeoutMs, tryConsumeRateLimit }, startedAt);
      return;
    }

    res.writeHead(404).end();
  });

  return { server, backend: resolved.backend };
}

function printBanner(port, backend, allowedOrigins) {
  console.log(`flurry-bridge v${BRIDGE_VERSION} — listening on http://localhost:${port}`);
  console.log(
    `backend: ${backend}${backend === "none" ? " (install claude CLI or set ANTHROPIC_API_KEY)" : ""}`,
  );
  console.log(`allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`\nIn FLURRY, [F3] CONFIG > DESKTOP BRIDGE, set port ${port}. That's it.`);
}

export function main() {
  const port = Number(process.env.FLURRY_BRIDGE_PORT) || DEFAULT_PORT;
  const { server, backend } = createBridgeServer({});
  server.listen(port, () => printBanner(port, backend, ALLOWED_ORIGINS));
}

if (process.env.NODE_ENV !== "test") {
  main();
}
