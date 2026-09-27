// Minimal, dependency-free parser for the task-spec frontmatter subset.
//
// Supported (and nothing else, on purpose, so specs stay greppable):
//   key: scalar                 -> string | number | boolean | null
//   key: [a, "b c", 3]          -> flow list of scalars
//   key:                        -> block list of scalars
//     - item
//     - "quoted item"
// Comments (`# ...` outside quotes) and blank lines are ignored.
// The block must start on line 1 with `---` and end with a `---` line.

const FENCE = /^---\s*$/;

export function splitFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (!FENCE.test(lines[0] ?? "")) return { data: null, body: text, raw: null };
  const end = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
  if (end === -1) throw new Error("frontmatter: missing closing ---");
  const raw = lines.slice(1, end).join("\n");
  return {
    data: parseFrontmatter(raw),
    body: lines.slice(end + 1).join("\n"),
    raw,
  };
}

function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === "\\" && q === '"') i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

export function parseScalar(s) {
  const v = s.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    return JSON.parse(v);
  }
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function splitFlow(inner) {
  const out = [];
  let cur = "";
  let q = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (q) {
      cur += c;
      if (c === "\\" && q === '"') cur += inner[++i] ?? "";
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim() !== "") out.push(cur);
  return out.map(parseScalar);
}

export function parseFrontmatter(raw) {
  const data = {};
  let listKey = null;
  raw.split("\n").forEach((original, idx) => {
    const line = stripComment(original).replace(/\s+$/, "");
    if (line.trim() === "") return;
    const item = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (item) {
      if (!listKey) throw new Error(`frontmatter line ${idx + 1}: list item without a key`);
      data[listKey].push(parseScalar(item[1]));
      return;
    }
    const kv = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!kv) throw new Error(`frontmatter line ${idx + 1}: cannot parse "${original}"`);
    const [, key, rest] = kv;
    if (rest === undefined || rest.trim() === "") {
      data[key] = [];
      listKey = key;
      return;
    }
    listKey = null;
    const v = rest.trim();
    data[key] = v.startsWith("[") && v.endsWith("]") ? splitFlow(v.slice(1, -1)) : parseScalar(v);
  });
  return data;
}

function fmtScalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v);
  if (s === "" || /^[\s\-?:,[\]{}#&*!|>'"%@`]|: | #|^(true|false|null|~|-?\d+(\.\d+)?)$|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

/** Serialise back to the same subset. Key order follows `order`, then the rest. */
export function stringifyFrontmatter(data, order = []) {
  const keys = [...order.filter((k) => k in data), ...Object.keys(data).filter((k) => !order.includes(k))];
  const out = [];
  for (const k of keys) {
    const v = data[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) out.push(`${k}: []`);
      else if (v.every((x) => typeof x === "number")) out.push(`${k}: [${v.join(", ")}]`);
      else {
        out.push(`${k}:`);
        for (const x of v) out.push(`  - ${fmtScalar(x)}`);
      }
    } else out.push(`${k}: ${fmtScalar(v)}`);
  }
  return `---\n${out.join("\n")}\n---\n`;
}
