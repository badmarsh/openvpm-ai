#!/usr/bin/env node
/**
 * Automated scanner for hardcoded strings and untranslated text in JSX/TSX.
 *
 * Usage:
 *   node scripts/scan-hardcoded-i18n.js                   # Scans all components and pages
 *   node scripts/scan-hardcoded-i18n.js components/billing # Scans specific directory or file
 *   node scripts/scan-hardcoded-i18n.js --symmetry        # Also checks en.json <-> sk.json symmetry
 *   node scripts/scan-hardcoded-i18n.js --summary         # Compact file summary
 */

const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.resolve(__dirname, "..");
const EN_PATH = path.join(WEB_ROOT, "messages/en.json");
const SK_PATH = path.join(WEB_ROOT, "messages/sk.json");

const DEFAULT_DIRS = [
  path.join(WEB_ROOT, "components"),
  path.join(WEB_ROOT, "app"),
];

const IGNORED_PATHS = [
  "__tests__",
  "node_modules",
  ".next",
  "components/ui", // Radix UI primitives usually don't have user copy
];

const PROPS_TO_CHECK = [
  "placeholder",
  "aria-label",
  "title",
];

// Parse command line arguments
const args = process.argv.slice(2);
const checkSymmetry = args.includes("--symmetry");
const summaryOnly = args.includes("--summary");
const customTarget = args.find((a) => !a.startsWith("--"));

// Helper to check if string contains actual English/human words
function isHumanText(str) {
  const trimmed = str.trim();
  if (!trimmed) return false;
  if (/^[{<].*[}>]$/.test(trimmed)) return false; // Expressions
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return false; // Hex colors
  if (/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(trimmed)) return false; // Prefixes/ids
  if (/^https?:\/\//.test(trimmed)) return false; // URLs
  if (/^[0-9.,:%/\\+—–-]+$/.test(trimmed)) return false; // Numbers / symbols only
  if (/^[a-z0-9_.-]+\.[a-z]{2,}$/i.test(trimmed)) return false; // Filenames / domains
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(trimmed)) return false; // MIME types / paths
  if (trimmed.length < 2) return false;

  // Must contain letters and spaces, or capitalized words
  return /[a-zA-Z]{2,}/.test(trimmed);
}

function findFiles(targetPath, fileList = []) {
  if (!fs.existsSync(targetPath)) return fileList;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (
      (targetPath.endsWith(".tsx") || targetPath.endsWith(".jsx")) &&
      !targetPath.includes(".test.") &&
      !targetPath.includes(".spec.")
    ) {
      fileList.push(targetPath);
    }
    return fileList;
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (IGNORED_PATHS.some((p) => fullPath.includes(p))) continue;
    if (entry.isDirectory()) {
      findFiles(fullPath, fileList);
    } else if (
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx")) &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check 1: Hardcoded "en-US" in date formatters
    if (line.includes('"en-US"') && (line.includes("toLocaleDateString") || line.includes("toLocaleString"))) {
      findings.push({
        lineNum,
        type: "hardcoded-en-us-date",
        text: line.trim(),
      });
    }

    // Check 2: Raw JSX text inside tags >Text<
    const jsxTextMatches = line.matchAll(/>([^<>{}\n]+)</g);
    for (const match of jsxTextMatches) {
      const text = match[1].trim();
      if (
        isHumanText(text) &&
        !text.startsWith("//") &&
        !text.startsWith("/*") &&
        !text.includes("&quot;") &&
        !text.includes("&apos;") &&
        !text.includes("className") &&
        text !== "→" &&
        text !== "←" &&
        text !== "·" &&
        text !== "—" &&
        text !== "|"
      ) {
        findings.push({
          lineNum,
          type: "raw-jsx-text",
          text,
        });
      }
    }

    // Check 3: String literal attributes: placeholder="...", aria-label="..."
    // Skip pure comment lines (`// ...`, `/* ... */`, `{/* ... */}`): an
    // attribute quoted inside a comment is never rendered.
    const isCommentLine = /^\s*(\/\/|\/\*|\*|\{\s*\/\*)/.test(line);
    for (const prop of isCommentLine ? [] : PROPS_TO_CHECK) {
      const regex = new RegExp(`${prop}="([^"{}\\n]+)"`, "g");
      const propMatches = line.matchAll(regex);
      for (const match of propMatches) {
        const val = match[1].trim();
        if (isHumanText(val)) {
          findings.push({
            lineNum,
            type: `prop-${prop}`,
            text: val,
          });
        }
      }
    }
  }

  return findings;
}

function runSymmetryCheck() {
  if (!fs.existsSync(EN_PATH) || !fs.existsSync(SK_PATH)) {
    console.log("⚠️ messages/en.json or sk.json not found.");
    return;
  }
  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
  const sk = JSON.parse(fs.readFileSync(SK_PATH, "utf8"));

  function keys(obj, prefix = "") {
    return Object.keys(obj).flatMap((k) => {
      const p = prefix ? `${prefix}.${k}` : k;
      return typeof obj[k] === "object" && obj[k] !== null
        ? keys(obj[k], p)
        : [p];
    });
  }

  const kEn = keys(en);
  const kSk = keys(sk);
  const sEn = new Set(kEn);
  const sSk = new Set(kSk);

  const missingInSk = kEn.filter((k) => !sSk.has(k));
  const extraInSk = kSk.filter((k) => !sEn.has(k));

  console.log("=== i18n Dictionary Symmetry Check ===");
  console.log(`EN catalog: ${kEn.length} keys | SK catalog: ${kSk.length} keys`);
  if (missingInSk.length === 0 && extraInSk.length === 0) {
    console.log("✓ 100% dictionary symmetry verified.\n");
  } else {
    if (missingInSk.length > 0) {
      console.error(`❌ Missing in SK (${missingInSk.length}):`, missingInSk.slice(0, 10));
    }
    if (extraInSk.length > 0) {
      console.error(`❌ Extra in SK (${extraInSk.length}):`, extraInSk.slice(0, 10));
    }
    console.log();
  }
}

function run() {
  if (checkSymmetry) {
    runSymmetryCheck();
  }

  let targets = DEFAULT_DIRS;
  if (customTarget) {
    const resolved = path.isAbsolute(customTarget)
      ? customTarget
      : path.resolve(process.cwd(), customTarget);
    targets = [resolved];
  }

  const allFiles = targets.flatMap((t) => findFiles(t));
  console.log(`Scanning ${allFiles.length} TSX/JSX files for untranslated strings...\n`);

  let totalFindings = 0;
  const fileReports = [];

  for (const file of allFiles) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      totalFindings += findings.length;
      fileReports.push({
        file: path.relative(WEB_ROOT, file),
        findings,
      });
    }
  }

  if (fileReports.length === 0) {
    console.log("✓ No hardcoded strings found in scanned files!");
    return;
  }

  console.log(`Found ${totalFindings} potentially untranslated strings in ${fileReports.length} files:\n`);

  if (summaryOnly) {
    for (const report of fileReports) {
      console.log(`- ${report.file}: ${report.findings.length} items`);
    }
    return;
  }

  for (const report of fileReports.slice(0, 30)) {
    console.log(`📁 ${report.file}:`);
    for (const item of report.findings.slice(0, 5)) {
      console.log(`   L${item.lineNum} [${item.type}]: "${item.text}"`);
    }
    if (report.findings.length > 5) {
      console.log(`   ... and ${report.findings.length - 5} more`);
    }
    console.log();
  }

  if (fileReports.length > 30) {
    console.log(`... and ${fileReports.length - 30} more files. Use specific path to drill down.`);
  }
}

run();
