// Ad-hoc helper: merge a JSON file of { "dot.key": { sk, en } } entries into
// messages/sk.json and messages/en.json. Existing keys are left untouched
// unless --force is passed. Keys are stored nested under their first segment
// (matching the dominant style of the dictionaries).
import fs from "node:fs";
import path from "node:path";

const [, , inputPath, ...flags] = process.argv;
const force = flags.includes("--force");
if (!inputPath) {
  console.error("usage: node scripts/i18n-add-keys.mjs <entries.json> [--force]");
  process.exit(1);
}

const root = path.resolve(process.cwd(), "messages");
const skPath = path.join(root, "sk.json");
const enPath = path.join(root, "en.json");
const sk = JSON.parse(fs.readFileSync(skPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const entries = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function getNested(obj, key) {
  if (typeof obj[key] === "string") return obj[key];
  let cur = obj;
  for (const part of key.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function setNested(obj, key, value) {
  const parts = key.split(".");
  // If a flat dotted key already exists at top level, update it in place.
  if (typeof obj[key] === "string") {
    obj[key] = value;
    return;
  }
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] === "string") {
      throw new Error(`Cannot nest under leaf "${parts.slice(0, i + 1).join(".")}" for key "${key}"`);
    }
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

let added = 0;
let skipped = 0;
for (const [key, val] of Object.entries(entries)) {
  if (typeof val.sk !== "string" || typeof val.en !== "string") {
    throw new Error(`Entry "${key}" must have both sk and en strings`);
  }
  const existsSk = getNested(sk, key) !== undefined;
  const existsEn = getNested(en, key) !== undefined;
  if (existsSk && existsEn && !force) {
    skipped++;
    continue;
  }
  if (!existsSk || force) setNested(sk, key, val.sk);
  if (!existsEn || force) setNested(en, key, val.en);
  added++;
}

fs.writeFileSync(skPath, JSON.stringify(sk, null, 2) + "\n");
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n");
console.log(`added/updated ${added}, skipped ${skipped} existing`);
