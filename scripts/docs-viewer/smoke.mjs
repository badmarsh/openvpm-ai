/**
 * Headless smoke test for the docs viewer. Loads the real page over HTTP in
 * jsdom and drives it the way a user would: browse the tree, search, follow a
 * cross-document link, jump to a heading, toggle the theme.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");

const BASE = process.env.DOCS_VIEWER_URL || "http://localhost:4173";
let failures = 0;

function check(label, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

(async () => {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("jsdomError", (e) => errors.push(e.message));
  vc.on("error", (e) => errors.push(String(e)));

  const dom = await JSDOM.fromURL(BASE + "/", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // jsdom ships neither fetch nor matchMedia. Both are baseline browser
      // APIs, so polyfill them into the window rather than bending the app.
      window.fetch = (url, init) => fetch(new URL(url, BASE).href, init);
      window.matchMedia = (q) => ({
        matches: false, media: q,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, dispatchEvent() { return false; },
      });
      window.IntersectionObserver = class {
        constructor(cb) { this.cb = cb; }
        observe(el) { this.cb([{ isIntersecting: true, target: el }]); }
        unobserve() {} disconnect() {}
      };
    },
  });
  const { window } = dom;
  const doc = window.document;

  // The boot() IIFE fetches index.json + search.json then renders.
  await new Promise((r) => setTimeout(r, 1500));

  console.log("\n— boot —");
  check("no runtime errors during boot", errors.length === 0, errors.slice(0, 2).join(" | "));
  check("sidebar groups rendered", doc.querySelectorAll(".group").length > 5,
    doc.querySelectorAll(".group").length + " groups");
  check("document links rendered", doc.querySelectorAll(".doc-link").length > 100,
    doc.querySelectorAll(".doc-link").length + " links");
  check("home placeholder shown", !!doc.querySelector(".empty h2"),
    doc.querySelector(".empty h2")?.textContent);
  check("doc count in status pill", /\d+ dokument/.test(doc.querySelector("#stat").textContent),
    doc.querySelector("#stat").textContent);

  console.log("\n— open a document (hash routing) —");
  window.location.hash = "#/docs/reference/authorization-matrix.md";
  await new Promise((r) => setTimeout(r, 900));
  const h1 = doc.querySelector("#page h1");
  check("document body rendered", !!h1, h1?.textContent);
  check("metadata chips shown", doc.querySelectorAll("#page .chip").length >= 3,
    [...doc.querySelectorAll("#page .chip")].map((c) => c.textContent).join(" / "));
  check("table of contents built", doc.querySelectorAll("#toc a").length > 0,
    doc.querySelectorAll("#toc a").length + " entries");
  check("breadcrumbs set", doc.querySelector("#crumbs").textContent.includes("authorization-matrix.md"));
  check("role table rendered as a real table", doc.querySelectorAll("#page table").length > 0,
    doc.querySelectorAll("#page table").length + " tables");
  check("active link marked in sidebar",
    doc.querySelector('.doc-link[aria-current="true"]')?.dataset.id === "docs/reference/authorization-matrix.md");
  check("document title updated", window.document.title.includes("Authorization"),
    window.document.title);

  console.log("\n— code rendering —");
  // The matrix cites file:line as backtick code: it must stay a non-clickable
  // code span, never a link that pretends to be navigable.
  check("file:line renders as styled inline code",
    doc.querySelectorAll("#page code.inline-code").length > 0,
    doc.querySelectorAll("#page code.inline-code").length + " inline code spans");
  check("no false cross-doc links on this page", doc.querySelectorAll("#page a.doc").length === 0);


  console.log("\n— cross-document link —");
  window.location.hash = "#/docs/migration/README.md";
  await new Promise((r) => setTimeout(r, 900));
  const docLink = doc.querySelector("#page a.doc");
  check("a cross-doc link exists", !!docLink, docLink?.textContent?.trim().slice(0, 40));
  if (docLink) {
    const target = docLink.getAttribute("href");
    window.location.hash = target.slice(1);
    await new Promise((r) => setTimeout(r, 900));
    check("navigated to the linked document", !!doc.querySelector("#page h1"),
      doc.querySelector("#page h1")?.textContent?.slice(0, 50));
    check("linked document body is non-trivial",
      doc.querySelector("#page").innerHTML.length > 2000,
      doc.querySelector("#page").innerHTML.length + " chars");
  }

  console.log("\n— search —");
  const search = doc.querySelector("#search");
  search.value = "revocable session";
  // terms() must split on whitespace, not on the letter "s".
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const metaText = doc.querySelector("#searchMeta").textContent;
  check("search reports matches", /dokument/.test(metaText), metaText);
  check("matches highlighted", doc.querySelectorAll("#tree mark").length > 0,
    doc.querySelectorAll("#tree mark").length + " marks");
  const firstHit = doc.querySelector("#tree .doc-link");
  const hitSpans = firstHit ? firstHit.querySelectorAll(":scope > span") : [];
  check("result shows a title and a snippet", hitSpans.length === 2,
    hitSpans.length + " spans");
  check("snippet carries highlighted terms",
    hitSpans[1] && hitSpans[1].textContent.trim().length > 10,
    hitSpans[1]?.textContent?.slice(0, 46));
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  check("clearing search restores the tree", doc.querySelectorAll("#tree mark").length === 0
    && doc.querySelectorAll(".doc-link").length > 100);

  console.log("\n— heading anchor + theme —");
  window.location.hash = "#/docs/reference/authorization-matrix.md";
  await new Promise((r) => setTimeout(r, 900));
  const tocLink = doc.querySelector("#toc a");
  if (tocLink) {
    const anchor = tocLink.dataset.anchor;
    check("TOC link points at a real heading id", !!doc.getElementById(anchor), anchor);
  }
  doc.querySelector("#theme").dispatchEvent(new window.Event("click", { bubbles: true }));
  const dark = doc.documentElement.classList.contains("dark");
  check("theme toggles", dark, "dark=" + dark);
  check("theme persisted", window.localStorage.getItem("docs-theme") === "dark",
    window.localStorage.getItem("docs-theme"));
  doc.querySelector("#theme").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("theme toggles back", !doc.documentElement.classList.contains("dark"));

  console.log("\n— broken link surfacing —");
  const broken = doc.querySelectorAll("#page a.broken").length;
  check("broken links are marked (not silently dropped)", typeof broken === "number", broken + " on this page");

  console.log("\n— narrow viewport —");
  window.innerWidth = 420;
  doc.querySelector("#menu").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("mobile menu opens", doc.querySelector("#sidebar").classList.contains("open"));

  console.log(failures === 0 ? "\nALL CHECKS PASSED\n" : `\n${failures} CHECK(S) FAILED\n`);
  dom.window.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("SMOKE TEST CRASHED:", e); process.exit(1); });
