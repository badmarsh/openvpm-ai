// Verification 2026-09-27 · Status: REFERENCE · Verdict: ARCHIVE · Ledger: 'tasks/VERIFICATION-LOG.md'
// Evidence: A helper that summarises 'tasks/web-test.json' (vitest JSON reporter). Run it from the repo root.
// Origin: 'tasks/parse-test-json.mjs' · first committed 2026-09-25 ('e9627504')

import { readFileSync } from "node:fs";
const raw = readFileSync("./tasks/web-test.json", "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length);
// JSON reporter may emit more than one JSON document; parse the longest line
let best = null;
for (const line of lines) {
  try {
    const d = JSON.parse(line);
    if (d && typeof d === "object" && Array.isArray(d.testResults)) {
      best = d;
      break;
    }
  } catch {
    // skip non-JSON / partial lines
  }
}
if (!best) { console.error("no JSON doc found"); process.exit(1); }
const failed = best.testResults.filter((t) => t.status === "failed");
console.log("FAILED SUITES:", failed.length, "/", best.testResults.length);
console.log("FAILED TESTS:", best.numFailedTests, "/", best.numTotalTests);
for (const s of failed) {
  const bad = s.assertionResults.filter((a) => a.status === "failed");
  console.log("\n### " + s.name.replace(/\\/g, "/").replace(/.*\/apps\/web\//, ""));
  console.log("  failed: " + bad.length);
  for (const a of bad) console.log("   x " + a.fullName);
}