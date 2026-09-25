import { readFileSync } from "node:fs";
const raw = readFileSync("./tasks/web-test.json", "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length);
let best = null;
for (const line of lines) {
  try {
    const d = JSON.parse(line);
    if (d && typeof d === "object" && Array.isArray(d.testResults)) { best = d; break; }
  } catch {}
}
if (!best) { console.error("no JSON doc found"); process.exit(1); }
const failed = best.testResults.filter((t) => t.status === "failed");
for (const s of failed) {
  const bad = s.assertionResults.filter((a) => a.status === "failed");
  console.log("\n===== " + s.name.replace(/\\/g, "/").replace(/.*\/apps\/web\//, "") + " =====");
  for (const a of bad) {
    console.log("--- " + a.fullName);
    const msg = (a.failureMessages || []).join("\n");
    // strip ANSI and truncate
    const clean = msg.replace(/\u001b\[[0-9;]*m/g, "");
    console.log(clean.slice(0, 1400));
  }
}