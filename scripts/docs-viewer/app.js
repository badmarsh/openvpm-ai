"use strict";
/* Hash-routed docs viewer. No framework: the payload is pre-rendered at build
   time, so this only has to do navigation, search and scroll-spy. */

const $ = (s, r = document) => r.querySelector(s);
const state = { index: [], search: [], byId: new Map(), query: "", groups: {} };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── Routing ─────────────────────────────────────── */
function currentId() {
  return decodeURIComponent(location.hash.replace(/^#\/?/, "")) || "";
}

async function render() {
  const id = currentId();
  if (!id) return renderHome();
  const meta = state.byId.get(id);
  const page = $("#page");
  if (!meta) {
    page.innerHTML = '<div class="empty"><h2>Dokument sa nenašiel</h2><p>' + esc(id) + "</p></div>";
    $("#toc").innerHTML = "";
    $("#stat").textContent = "";
    return;
  }
  $("#stat").textContent = meta.minutes + " min · " + meta.words.toLocaleString("sk") + " slov";
  $("#crumbs").innerHTML = "<b>" + esc(meta.title) + "</b> · " + esc(meta.id);
  document.title = meta.title + " — OpenVPM dokumentácia";

  const res = await fetch("./data/pages/" + meta.file);
  page.innerHTML =
    '<div class="doc-meta"><span class="chip path">' + esc(meta.id) + "</span>" +
    '<span class="chip">' + meta.minutes + " min čítania</span>" +
    '<span class="chip">' + meta.words.toLocaleString("sk") + " slov</span>" +
    (meta.headings.length ? '<span class="chip">' + meta.headings.length + " sekcií</span>" : "") +
    "</div>" + (await res.text());

  buildToc(meta);
  page.scrollTop = 0;
  markCurrent(id);
}

function renderHome() {
  $("#page").innerHTML =
    '<div class="empty"><h2>Technická dokumentácia</h2>' +
    "<p>Vyber si dokument zo stromu vľavo alebo začni hľadaním.</p>" +
    '<p class="keys"><kbd>/</kbd> hľadať · <kbd>Esc</kbd> zrušiť</p></div>';
  $("#toc").innerHTML = "";
  $("#stat").textContent = state.index.length + " dokumentov";
  $("#crumbs").textContent = "";
  markCurrent("");
}

function buildToc(meta) {
  const items = meta.headings.filter((h) => h.depth > 1);
  $("#toc").innerHTML = items.length
    ? '<div class="toc-inner"><h4>Na tejto stránke</h4>' +
      items.map((h) => '<a href="#/' + encodeURI(meta.id) + "#" + h.id + '" data-d="' + h.depth +
        '" data-anchor="' + h.id + '">' + esc(h.text) + "</a>").join("") + "</div>"
    : "";
  observe(items);
}

function markCurrent(id) {
  document.querySelectorAll(".doc-link").forEach((a) =>
    a.setAttribute("aria-current", a.dataset.id === id ? "true" : "false"));
}

/* ── Sidebar ─────────────────────────────────────── */
function buildTree() {
  const groups = new Map();
  for (const m of state.index) {
    if (!groups.has(m.group)) groups.set(m.group, []);
    groups.get(m.group).push(m);
  }
  state.groups = groups;
  const open = new Set([...groups.keys()].slice(0, 4));

  $("#tree").innerHTML = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "sk", { numeric: true }))
    .map(([g, items]) =>
      '<div class="group" data-open="' + open.has(g) + '">' +
      '<button class="group-btn" data-group="' + esc(g) + '">' +
      '<span class="caret">▼</span><span>' + esc(g) + "</span>" +
      '<span class="group-count">' + items.length + "</span></button>" +
      '<div class="group-items">' +
      items.map((m) => '<a class="doc-link" data-id="' + esc(m.id) + '" href="#/' +
        encodeURI(m.id) + '" title="' + esc(m.id) + '">' + esc(m.title) + "</a>").join("") +
      "</div></div>").join("");

  $("#tree").addEventListener("click", (e) => {
    const btn = e.target.closest(".group-btn");
    if (!btn) return;
    const el = btn.closest(".group");
    el.dataset.open = el.dataset.open === "true" ? "false" : "true";
  });
}

/* ── Search ──────────────────────────────────────── */
/* Terms are ANDed, so "revocable session" finds a page that says
   "revocable" in one place and "session" in another. A naive substring match
   finds nothing there, which is the common case for technical prose. */
function terms(q) {
  return q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
}

function runSearch(q) {
  const meta = $("#searchMeta");
  if (!q) {
    meta.hidden = true;
    buildTree();
    return;
  }
  const words = terms(q);
  const needle = words.join(" ");
  const hits = [];
  for (const s of state.search) {
    const t = s.title.toLowerCase(), g = s.group.toLowerCase(), h = s.h.toLowerCase(), b = s.text.toLowerCase();
    let score = 0, at = -1, ok = true;
    for (const w of words) {
      const ti = t.indexOf(w), gi = g.indexOf(w), hi = h.indexOf(w), bi = b.indexOf(w);
      if (bi === -1 && ti === -1 && hi === -1 && gi === -1) { ok = false; break; }
      let term = 0;
      if (ti !== -1) term += ti === 0 ? 200 : 100;
      if (gi !== -1) term += 40;
      if (hi !== -1) term += 60;
      if (bi !== -1) term += 10;
      score += term;
      if (bi !== -1 && (at === -1 || bi < at)) at = bi;
    }
    if (!ok) continue;
    const bodyHits = b.split(needle).length - 1;
    hits.push({ s, score: score + Math.min(bodyHits, 20), at });
  }
  hits.sort((a, b) => b.score - a.score);
  const shown = hits.slice(0, 120);
  meta.hidden = false;
  meta.textContent = shown.length + " z " + state.search.length + " dokumentov" +
    (hits.length > 120 ? " (zobrazených prvých 120)" : "");

  const groups = new Map();
  for (const h of shown) {
    if (!groups.has(h.s.group)) groups.set(h.s.group, []);
    groups.get(h.s.group).push(h);
  }
  $("#tree").innerHTML = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([g, items]) =>
      '<div class="group" data-open="true">' +
      '<button class="group-btn"><span class="caret">▼</span><span>' + esc(g) + "</span>" +
      '<span class="group-count">' + items.length + "</span></button>" +
      '<div class="group-items">' +
      items.map((h) => {
        const m = state.byId.get(h.s.id);
        const snip = snippet(h.s.text, words);
        return '<a class="doc-link" data-id="' + esc(h.s.id) + '" href="#/' +
          encodeURI(h.s.id) + '" style="white-space:normal">' +
          '<span style="display:block">' + highlightTerms(m.title, words) + "</span>" +
          (snip ? '<span style="display:block;font-size:11px;opacity:.75">' + snip + "</span>" : "") +
          "</a>";
      }).join("") + "</div></div>").join("");
  markCurrent(currentId());
}

function highlightTerms(text, words) {
  if (!words.length) return esc(text);
  const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return esc(text).replace(re, "<mark>$1</mark>");
}

function snippet(text, words) {
  const lower = text.toLowerCase();
  let at = -1;
  for (const w of words) { const i = lower.indexOf(w); if (i !== -1 && (at === -1 || i < at)) at = i; }
  if (at === -1) return "";
  const start = Math.max(0, at - 42);
  return (start ? "…" : "") + highlightTerms(text.slice(start, start + 118), words) + "…";
}

/* ── Scroll spy ──────────────────────────────────── */
let spy = null;
function observe(items) {
  if (spy) spy.disconnect();
  if (!items.length) return;
  const links = new Map();
  document.querySelectorAll("#toc a").forEach((a) => links.set(a.dataset.anchor, a));
  spy = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const a = links.get(en.target.id);
      if (!a) continue;
      document.querySelectorAll("#toc a").forEach((x) => x.classList.remove("on"));
      a.classList.add("on");
    }
  }, { root: $("#page"), rootMargin: "0px 0px -70% 0px" });
  items.forEach((h) => { const el = document.getElementById(h.id); if (el) spy.observe(el); });
}

/* ── Theme ───────────────────────────────────────── */
function applyTheme(t) {
  document.documentElement.classList.toggle("dark", t === "dark");
  localStorage.setItem("docs-theme", t);
}
$("#theme").addEventListener("click", () =>
  applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"));

/* ── Keys ────────────────────────────────────────── */
addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "");
  if (e.key === "/" && !typing) { e.preventDefault(); $("#search").focus(); return; }
  if (e.key === "Escape") {
    if (typing) { $("#search").value = ""; runSearch(""); $("#search").blur(); }
    $("#sidebar").classList.remove("open");
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); $("#search").focus(); $("#search").select();
  }
});

$("#search").addEventListener("input", (e) => runSearch(e.target.value.trim()));
$("#menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
addEventListener("hashchange", render);
document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href^="#/"]');
  if (link) $("#sidebar").classList.remove("open");
});

/* ── Boot ────────────────────────────────────────── */
(async function boot() {
  const stored = localStorage.getItem("docs-theme");
  const prefersDark = typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored || (prefersDark ? "dark" : "light"));

  const [index, search] = await Promise.all([
    fetch("./data/index.json").then((r) => r.json()),
    fetch("./data/search.json").then((r) => r.json()),
  ]);
  state.index = index;
  state.search = search;
  for (const m of index) {
    const h = 0x811c9dc5;
    let x = h;
    for (let i = 0; i < m.id.length; i++) { x ^= m.id.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    m.file = x.toString(36) + "-" + m.id.length.toString(36) + ".html";
    state.byId.set(m.id, m);
  }
  buildTree();
  render();
})();
