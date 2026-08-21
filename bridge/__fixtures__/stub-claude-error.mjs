#!/usr/bin/env node
// Test double for a claude CLI failure (is_error: true), exits 1.
process.stdout.write(
  JSON.stringify({ is_error: true, result: "stub failure", subtype: "error_max_turns" }),
);
process.exit(1);
