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
const WRAPPER_TAGS = new Set(["DataTableFrame", "TableScroll"]);

function isWrapperOpeningTag(
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile
): boolean {
  const tagName = opening.tagName.getText(sourceFile);
  if (WRAPPER_TAGS.has(tagName)) return true;
  return opening.attributes.properties.some(
    (attr) =>
      ts.isJsxAttribute(attr) &&
      attr.name.getText(sourceFile) === "className" &&
      attr.initializer !== undefined &&
      attr.initializer.getText(sourceFile).includes("overflow-x-auto")
  );
}

// Walks the JSX tree tracking whether a <table> is structurally nested inside
// a DataTableFrame/TableScroll/overflow-x-auto ancestor, rather than checking
// nearby source lines. A <table> can be legitimately wrapped many lines above
// its own tag when separated by conditional (loading/empty-state) branches —
// line-proximity checks produce false positives in that case.
function findUnwrappedTableLines(filePath: string, content: string): number[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TSX
  );

  const offendingLines: number[] = [];

  function reportIfUnwrapped(node: ts.Node, tagName: string, wrapped: boolean) {
    if (tagName === "table" && !wrapped) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      offendingLines.push(line);
    }
  }

  function walk(node: ts.Node, wrapped: boolean) {
    if (ts.isJsxElement(node)) {
      const nested = wrapped || isWrapperOpeningTag(node.openingElement, sourceFile);
      reportIfUnwrapped(node.openingElement, node.openingElement.tagName.getText(sourceFile), wrapped);
      node.children.forEach((child) => walk(child, nested));
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      reportIfUnwrapped(node, node.tagName.getText(sourceFile), wrapped);
      return;
    }

    if (ts.isJsxFragment(node)) {
      node.children.forEach((child) => walk(child, wrapped));
      return;
    }

    ts.forEachChild(node, (child) => walk(child, wrapped));
  }

  walk(sourceFile, false);
  return offendingLines;
}

describe("responsive dashboard and portal tables", () => {
  it("wraps tables in horizontal scroll containers", () => {
    const offenders: string[] = [];

    for (const file of TABLE_PAGE_ROOTS.flatMap(tsxFiles)) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("<table")) continue;

      for (const lineIndex of findUnwrappedTableLines(file, content)) {
        offenders.push(`${file}:${lineIndex + 1}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
