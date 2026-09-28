/**
 * Build-output check for the docs viewer.
 *
 * Guards a real regression: overriding marked's `code` renderer instead of
 * `codespan` hijacks fenced code blocks, strips the <pre> wrapper and destroys
 * indentation on every page in the repo. This asserts on the built HTML.
 *
 *   node scripts/docs-viewer/code-check.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../artifacts/docs-viewer/data/pages");

let pages = 0;
let fences = 0;
let inlineStyled = 0;
const stray = [];

for (const file of readdirSync(dir)) {
  const html = readFileSync(join(dir, file), "utf8");
  pages++;
  fences += (html.match(/<pre><code/g) || []).length;
  inlineStyled += (html.match(/class="inline-code"/g) || []).length;

  // Strip fenced blocks; any bare <code> left over is an unstyled inline span.
  const withoutFences = html.replace(/<pre><code[\s\S]*?<\/code><\/pre>/g, "");
  const bare = (withoutFences.match(/<code>/g) || []).length;
  if (bare) stray.push(`${file}:${bare}`);
}

console.log(`pages:                     ${pages}`);
console.log(`fenced blocks with <pre>:   ${fences}`);
console.log(`styled inline code spans:   ${inlineStyled}`);
console.log(`unstyled inline <code>:     ${stray.length ? stray.join(", ") : "0"}`);

const ok = stray.length === 0 && fences > 0 && inlineStyled > 0;
console.log(ok ? "\nCODE RENDERING OK" : "\nCODE RENDERING BROKEN");
process.exit(ok ? 0 : 1);
