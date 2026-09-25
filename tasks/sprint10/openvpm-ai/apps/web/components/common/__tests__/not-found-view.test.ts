import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotFoundView } from "../not-found-view";

describe("NotFoundView", () => {
  it("renders a branded 404 recovery state with localized text", () => {
    const markup = renderToStaticMarkup(createElement(NotFoundView));

    expect(markup).toContain("404");
    expect(markup).toContain("Stránka sa nenašla");
    expect(markup).toContain("Táto stránka sa pravdepodobne presunula");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Prejsť na prehľad");
    expect(markup).toContain('id="main-content"');
  });
});
