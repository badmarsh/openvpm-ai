import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function tsxFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? tsxFiles(path) : [path];
  }).filter((path) => path.endsWith(".tsx"));
}

const TABLE_PAGE_ROOTS = ["app/(dashboard)", "app/portal"];

function findJsxTableLineNumbers(filePath: string, content: string): number[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TSX
  );

  const tableLines: number[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sourceFile) === "table") {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        tableLines.push(line);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return tableLines;
}

describe("responsive dashboard and portal tables", () => {
  it("wraps tables in horizontal scroll containers", () => {
    const offenders: string[] = [];

    for (const file of TABLE_PAGE_ROOTS.flatMap(tsxFiles)) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("<table")) continue;

      const lines = content.split("\n");
      const tableLines = findJsxTableLineNumbers(file, content);

      for (const lineIndex of tableLines) {
        const localWrapper = lines
          .slice(Math.max(0, lineIndex - 5), lineIndex + 1)
          .some(
            (candidate) =>
              candidate.includes("overflow-x-auto") ||
              candidate.includes("<TableScroll")
          );
        if (!localWrapper) {
          offenders.push(`${file}:${lineIndex + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
