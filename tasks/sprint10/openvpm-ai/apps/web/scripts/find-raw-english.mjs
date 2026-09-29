// Ad-hoc audit helper (not part of the build): finds raw JSX text / string
// attributes in app/(dashboard) that look like English and are not wrapped in t().
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? "app/(dashboard)";
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
  }
}
walk(root);

// Common English words that strongly indicate an English sentence.
const EN_WORDS =
  /\b(the|and|for|with|your|you|this|that|from|are|is|not|will|can|to|of|in|on|or|be|by|an|at|as|it|no|all|new|add|save|cancel|delete|edit|search|loading|please|select|enter|found|failed|error|success|patient|patients|client|clients|appointment|appointments|report|reports|schedule|invoice|created|updated|required|optional|view|open|close|back|next|previous|send|copy|copied|print|download|upload|status|date|time|name|type|total|amount|price|quantity|notes|details|summary|history|settings|manage|create|generate|generated|analysis|write|read|mode|live|quick|tips|tip|suggestions|ready|available|unavailable|active|inactive|pending|completed|draft|finalized|today|week|month|year|last|first|days|hours|minutes|ago)\b/i;

// Slovak diacritics or typical Slovak words → treat as Slovak (allowed).
const SK_HINT = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]|\b(a|na|pre|pri|do|od|sa|so|si|je|sú|nie|ako|alebo|podľa|bez|cez|pod|nad|po|za|zo|ku|ak|aj|len|už|tu|to|ten|tá|táto|tento|vy|vaše|vašu|váš|vaša|prosím|zadajte|vyberte|vytvoriť|uložiť|zrušiť|odoslať|pacient|pacienta|pacienti|klient|klienta|termín|termíny|správa|správy|záznam|záznamy)\b/;

function looksEnglish(s) {
  const txt = s.replace(/\s+/g, " ").trim();
  if (txt.length < 3) return false;
  if (!/[A-Za-z]{3,}/.test(txt)) return false;
  if (SK_HINT.test(txt)) return false;
  // Two or more english hint words, or one hint word + >= 2 words
  const hits = txt.match(new RegExp(EN_WORDS.source, "gi")) ?? [];
  const words = txt.split(" ").filter(Boolean);
  if (hits.length >= 2) return true;
  if (hits.length === 1 && words.length >= 2) return true;
  // Single capitalised English-y word like "Live" "Cancel" etc.
  if (words.length === 1 && hits.length === 1) return true;
  return false;
}

const findings = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText();
      if (looksEnglish(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        findings.push({ file, line: line + 1, kind: "jsxText", text: text.trim() });
      }
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const attr = node.name.getText();
      if (/^(placeholder|title|aria-label|alt|label|description)$/.test(attr)) {
        const text = node.initializer.text;
        if (looksEnglish(text)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          findings.push({ file, line: line + 1, kind: `attr:${attr}`, text });
        }
      }
    }
    // JSX expression containing a bare string literal: {"Some text"} or {cond ? "A" : "B"}
    if (ts.isJsxExpression(node) && node.expression) {
      const collect = (e) => {
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
          if (looksEnglish(e.text)) {
            const { line } = sf.getLineAndCharacterOfPosition(e.getStart());
            findings.push({ file, line: line + 1, kind: "jsxExprString", text: e.text });
          }
        } else if (ts.isConditionalExpression(e)) {
          collect(e.whenTrue);
          collect(e.whenFalse);
        } else if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
          collect(e.right);
        } else if (ts.isTemplateExpression(e)) {
          const full = e.head.text + e.templateSpans.map((s) => " X " + s.literal.text).join("");
          if (looksEnglish(full)) {
            const { line } = sf.getLineAndCharacterOfPosition(e.getStart());
            findings.push({ file, line: line + 1, kind: "jsxTemplate", text: full });
          }
        }
      };
      collect(node.expression);
    }
    // toast.*("English")
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText() === "toast") {
      const a = node.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && looksEnglish(a.text)) {
        const { line } = sf.getLineAndCharacterOfPosition(a.getStart());
        findings.push({ file, line: line + 1, kind: "toast", text: a.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const byFile = {};
for (const f of findings) (byFile[f.file] ??= []).push(f);
for (const [file, list] of Object.entries(byFile)) {
  console.log(`\n## ${file} (${list.length})`);
  for (const f of list) console.log(`  L${f.line} [${f.kind}] ${f.text.slice(0, 110)}`);
}
console.log(`\nTOTAL: ${findings.length} candidates in ${Object.keys(byFile).length} files`);
