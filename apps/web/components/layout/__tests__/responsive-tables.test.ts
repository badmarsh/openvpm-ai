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

/**
 * Components that render their children inside a horizontal-scroll container.
 * `DataTableFrame` (components/layout/page-kit.tsx) nests `TableScroll`
 * (components/common/table-scroll.tsx), whose inner element carries
 * `overflow-x-auto`, so any of these three signals counts as a wrapper.
 */
const SCROLL_WRAPPER_COMPONENTS = new Set(["DataTableFrame", "TableScroll"]);

const HORIZONTAL_SCROLL_CLASS = "overflow-x-auto";

interface JsxTable {
  /** 0-based line of the `<table>` tag. */
  line: number;
  /** Whether a horizontal-scroll ancestor encloses the table. */
  wrapped: boolean;
}

/** True when the element's own `className` mentions `overflow-x-auto`, e.g.
 *  `className="overflow-x-auto"`, `` className={`${cls} overflow-x-auto`} ``
 *  or `className={cn("overflow-x-auto")}`. */
function hasHorizontalScrollClass(
  attributes: ts.JsxAttributes,
  sourceFile: ts.SourceFile,
): boolean {
  return attributes.properties.some((property) => {
    if (!ts.isJsxAttribute(property)) return false;
    if (property.name.getText(sourceFile) !== "className") return false;
    return (
      property.initializer?.getText(sourceFile).includes(HORIZONTAL_SCROLL_CLASS) ?? false
    );
  });
}

function describeElement(
  element: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
): { name: string; scrollWrapper: boolean } {
  const name = element.tagName.getText(sourceFile);
  return {
    name,
    scrollWrapper:
      SCROLL_WRAPPER_COMPONENTS.has(name) ||
      hasHorizontalScrollClass(element.attributes, sourceFile),
  };
}

/**
 * Walks the JSX tree with an ancestor stack: entering a JSX element pushes it,
 * leaving pops it. A `<table>` is "wrapped" only when one of the elements
 * currently on the stack provides horizontal scrolling — i.e. the wrapper is a
 * real ancestor, however many lines (and however many conditional branches)
 * sit between the two tags. Proximity heuristics missed cases like
 * `prescriptions/page.tsx`, where `<table>` lives three ternary branches below
 * its `<DataTableFrame>`.
 */
function findJsxTableLineNumbers(filePath: string, content: string): JsxTable[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TSX
  );

  const tables: JsxTable[] = [];
  const ancestors: { name: string; scrollWrapper: boolean }[] = [];

  const lineOf = (node: ts.Node): number =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;

  const isWrapped = (): boolean => ancestors.some((ancestor) => ancestor.scrollWrapper);

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const element = describeElement(node.openingElement, sourceFile);
      if (element.name === "table") {
        tables.push({ line: lineOf(node.openingElement), wrapped: isWrapped() });
      }
      ancestors.push(element);
      ts.forEachChild(node, visit);
      ancestors.pop();
      return;
    }

    // A self-closing element cannot contain JSX children, but `<table />`
    // itself still needs a scrolling ancestor — and attribute expressions may
    // hold JSX (`<Foo render={<table />} />`), so keep walking them.
    if (ts.isJsxSelfClosingElement(node)) {
      const element = describeElement(node, sourceFile);
      if (element.name === "table") {
        tables.push({ line: lineOf(node), wrapped: isWrapped() });
      }
      ts.forEachChild(node, visit);
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return tables;
}

describe("responsive dashboard and portal tables", () => {
  it("wraps tables in horizontal scroll containers", () => {
    const offenders: string[] = [];

    for (const file of TABLE_PAGE_ROOTS.flatMap(tsxFiles)) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("<table")) continue;

      for (const table of findJsxTableLineNumbers(file, content)) {
        if (!table.wrapped) {
          offenders.push(`${file}:${table.line + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("detects unwrapped tables through conditionals and rejects bare tables", () => {
    const wrapped = [
      "export function Page() {",
      "  return (",
      "    <DataTableFrame>",
      "      {isLoading ? <TableSkeleton rows={10} /> : <table><tbody /></table>}",
      "    </DataTableFrame>",
      "  );",
      "}",
    ].join("\n");
    const wrappedByClass = [
      "export function Page() {",
      '  return <div className="overflow-x-auto"><table><tbody /></table></div>;',
      "}",
    ].join("\n");
    const wrappedByTableScroll = [
      "export function Page() {",
      "  return <TableScroll><table><tbody /></table></TableScroll>;",
      "}",
    ].join("\n");
    const unwrapped = [
      "export function Page() {",
      "  return <div className=\"rounded border\"><table><tbody /></table></div>;",
      "}",
    ].join("\n");

    for (const fixture of [wrapped, wrappedByClass, wrappedByTableScroll]) {
      const tables = findJsxTableLineNumbers("fixture.tsx", fixture);
      expect(tables).toHaveLength(1);
      expect(tables[0].wrapped).toBe(true);
    }

    expect(findJsxTableLineNumbers("fixture.tsx", unwrapped)).toEqual([
      { line: 1, wrapped: false },
    ]);
  });
});
