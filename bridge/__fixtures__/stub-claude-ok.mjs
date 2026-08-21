#!/usr/bin/env node
// Test double for the claude CLI: ignores all args, prints a fixed
// --output-format json shaped response, exits 0. If STUB_LOG_PATH is set,
// appends one line per *dossier* invocation (argv containing "-p") — tests
// use this to prove the CLI was, or wasn't, invoked for a given request.
// resolveBackend()'s own "--version" capability probe is deliberately not
// logged here, so the count reflects actual dossier calls only.
import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
if (process.env.STUB_LOG_PATH && args.includes("-p")) {
  appendFileSync(process.env.STUB_LOG_PATH, JSON.stringify(args) + "\n");
}

process.stdout.write(
  JSON.stringify({
    is_error: false,
    result: "VERDICT: CLEAR\nCONFIDENCE: LOW\nREAD: stub dossier.",
    subtype: "success",
  }),
);
process.exit(0);
