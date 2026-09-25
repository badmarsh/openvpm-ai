/**
 * arena-dispatcher.ts
 * Standalone Playwright dispatcher pre Arena.ai.
 * Protokol: 1) repo lock  2) ABORT ak zlyhal  3) fill+truncate guard  4) submit  5) session URL
 */

import { chromium, type Page, type Browser } from "playwright";

// ─── Konfigurácia ────────────────────────────────────────────────────────────

const TARGET_REPO = process.env.ARENA_DEFAULT_GITHUB_REPO ?? "badmarsh/openvpm-ai";
const ARENA_AGENT_URL = process.env.ARENA_AGENT_ORIGIN
  ? `${process.env.ARENA_AGENT_ORIGIN}/agent`
  : "https://arena.ai/agent";
const CDP_ENDPOINT = process.env.ARENA_CDP_ENDPOINT ?? "http://localhost:9222";

// ─── Selektory ───────────────────────────────────────────────────────────────

const REPO_BTN_SELECTORS = [
  "button:has-text('Select a repository')",
  `button:has-text('${TARGET_REPO}')`,
  "button:has-text('badmarsh/')",
] as const;

const COMPOSER_SELECTORS = [
  "div[contenteditable='true']",
  "textarea:not([name*='recaptcha']):not([class*='recaptcha'])",
  "[role='textbox']",
] as const;

const SUBMIT_SELECTORS = [
  "button[aria-label='Send message']",
  "button[aria-label*='Send']",
  "button[data-testid='send-button']",
  "form button[type='submit']",
] as const;

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface DispatchResult {
  ok: boolean;
  arenaSessionId: string | null;
  arenaUrl: string;
  message: string;
}

export interface FillAndSubmitResult {
  filled: boolean;
  submitted: boolean;
  detail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readElementText(page: Page, selector: string): Promise<string> {
  try {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible())) return "";
    const tag = await loc.evaluate((el: Element) => el.tagName.toLowerCase());
    if (tag === "textarea" || tag === "input") return ((await loc.inputValue()) ?? "").trim();
    return ((await loc.innerText()) ?? "").trim();
  } catch { return ""; }
}

async function firstVisible(
  page: Page,
  selectors: readonly string[],
  requireEnabled = false,
): Promise<ReturnType<Page["locator"]> | null> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (!(await loc.isVisible())) continue;
      if (requireEnabled && !(await loc.isEnabled())) continue;
      return loc;
    } catch { continue; }
  }
  return null;
}

function extractSessionId(url: string): string | null {
  const m = url.match(/\/agent\/([A-Za-z0-9_-]{8,})/);
  return m ? m[1] : null;
}

// ─── Krok 1: 2-pokusový verifikačný zámok repozitára ─────────────────────────

/**
 * Zabezpečí výber repozitara v Arena.ai UI.
 * @returns true = repo zamknuty (alebo nebol potrebny), false = DISPATCH_ABORTED.
 */
export async function ensureArenaRepositorySelected(
  page: Page,
  targetRepo = TARGET_REPO,
  maxAttempts = 2,
): Promise<boolean> {
  const findRepoButton = () => firstVisible(page, REPO_BTN_SELECTORS);

  const btn = await findRepoButton();
  if (!btn) return true; // Tlacidlo neexistuje -> session uz bezi

  const initialText = ((await btn.innerText()) ?? "").trim();
  if (initialText.includes(targetRepo)) return true; // Uz spravny repo

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const repoBtnNow = await findRepoButton();
    if (!repoBtnNow) return true;

    // Krok A: klik na tlacidlo repozitara
    try { await repoBtnNow.click(); } catch { /* ignoruj */ }

    // Krok B: cakanie na [role="dialog"] (max 400 ms), druhý pokus ak treba
    let dialogOpen = false;
    try {
      await page.waitForSelector("[role='dialog']", { timeout: 400 });
      dialogOpen = true;
    } catch { /* nezobrazilo sa na 1. klik */ }

    if (!dialogOpen) {
      try {
        await repoBtnNow.click();
        await page.waitForSelector("[role='dialog']", { timeout: 500 });
      } catch { /* pokracuj a skus najst option */ }
    }

    // Krok C: kliknutie na option targetRepo
    try {
      const optionSel = `[role='dialog'] [role='option']:has-text('${targetRepo}')`;
      const option = page.locator(optionSel).first();

      if (await option.isVisible()) {
        await option.click();
      } else {
        // Scrollovanie cez zoznam ak option nie je prima viditelna
        const allOpts = page.locator("[role='dialog'] [role='option']");
        const count = await allOpts.count();
        let found = false;
        for (let i = 0; i < count; i++) {
          const opt = allOpts.nth(i);
          const text = ((await opt.innerText()) ?? "").trim();
          if (text.includes(targetRepo)) {
            await opt.scrollIntoViewIfNeeded();
            await opt.click();
            found = true;
            break;
          }
        }
        if (!found) { await page.waitForTimeout(400); continue; }
      }
    } catch { await page.waitForTimeout(400); continue; }

    // Krok D: verifikacia zamku (500 ms cooldown)
    await page.waitForTimeout(500);
    const verifyBtn = await findRepoButton();
    if (!verifyBtn) return true; // zmizlo = session sa nastartovala

    try {
      const newText = ((await verifyBtn.innerText()) ?? "").trim();
      if (newText.includes(targetRepo)) return true; // LOCK ACQUIRED
    } catch { /* dalsi pokus */ }

    await page.waitForTimeout(400);
  }

  return false; // DISPATCH_ABORTED
}

// ─── Kroky 2–4: Fill + Truncate Guard + Submit ───────────────────────────────

/**
 * Vlozi prompt do Composera s Truncate Guard a odesle spravu.
 */
export async function fillAndSubmit(
  page: Page,
  promptText: string,
  autoSubmit = true,
): Promise<FillAndSubmitResult> {
  const composer = await firstVisible(page, COMPOSER_SELECTORS, false);
  if (!composer) return { filled: false, submitted: false, detail: "composer_missing" };

  try {
    await composer.fill("");
    await composer.fill(promptText);
  } catch (err) {
    return { filled: false, submitted: false, detail: `fill_failed:${err}` };
  }

  // Truncate Guard: text v DOM musi mat >= 95 % dlzky originalneho promptu
  const domText = await readElementText(page, COMPOSER_SELECTORS[0]);
  const minExpected = Math.floor(promptText.trim().length * 0.95);
  if (domText.length < minExpected) {
    return {
      filled: false,
      submitted: false,
      detail: `fill_truncated: expected>= ${minExpected} got ${domText.length}`,
    };
  }

  if (!autoSubmit) return { filled: true, submitted: false, detail: "filled_no_submit" };

  // Pokus 1: klik na submit tlacidlo
  const submitBtn = await firstVisible(page, SUBMIT_SELECTORS, true);
  if (submitBtn) {
    try {
      await submitBtn.click({ timeout: 1500 });
      return { filled: true, submitted: true, detail: "submitted_button_click" };
    } catch {
      try {
        const box = await submitBtn.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          return { filled: true, submitted: true, detail: "submitted_mouse_click" };
        }
      } catch { /* ignoruj */ }
    }
  }

  // Pokus 2: Enter v Composeri
  try {
    await composer.press("Enter");
    return { filled: true, submitted: true, detail: "submitted_enter" };
  } catch (err) {
    return { filled: true, submitted: false, detail: `submit_failed:${err}` };
  }
}

// ─── Krok 5: Cakanie na arena_session_id v URL ───────────────────────────────

async function waitForSessionUrl(page: Page, timeoutMs = 8000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();
    if (extractSessionId(url)) return url;
    await page.waitForTimeout(250);
  }
  return page.url();
}

// ─── Hlavna exportovana funkcia ──────────────────────────────────────────────

/**
 * Kompletny dispatch cyklus do Arena.ai.
 *
 * Poradie krokov je neobiditelne:
 *   1. ensureArenaRepositorySelected  (2-pokusovy verifikacny zamok)
 *   2. ABORT ak repo lock zlyhal      (prompt NIE JE odoslany)
 *   3. fillAndSubmit                  (Truncate Guard + odoslanie)
 *   4. waitForSessionUrl              (arena_session_id z URL)
 */
export async function dispatchToArena(
  page: Page,
  promptText: string,
  opts: { targetRepo?: string; autoSubmit?: boolean; maxRepoAttempts?: number } = {},
): Promise<DispatchResult> {
  const { targetRepo = TARGET_REPO, autoSubmit = true, maxRepoAttempts = 2 } = opts;

  // 1. Repository lock
  const repoLocked = await ensureArenaRepositorySelected(page, targetRepo, maxRepoAttempts);
  if (!repoLocked) {
    return {
      ok: false,
      arenaSessionId: null,
      arenaUrl: page.url(),
      message: `DISPATCH_ABORTED: Nepodarilo sa uzamknut repozitar ${targetRepo} v Arena UI. Prompt NEBOL odoslany.`,
    };
  }

  // 2-4. Fill + Submit
  const { filled, submitted, detail } = await fillAndSubmit(page, promptText, autoSubmit);
  if (!filled || (autoSubmit && !submitted)) {
    return { ok: false, arenaSessionId: null, arenaUrl: page.url(), message: `DISPATCH_FAILED reason=${detail}` };
  }

  // 5. Cakanie na session URL
  const finalUrl = await waitForSessionUrl(page);
  return {
    ok: true,
    arenaSessionId: extractSessionId(finalUrl),
    arenaUrl: finalUrl,
    message: detail,
  };
}

// ─── Standalone CLI entry-point ───────────────────────────────────────────────
// Pouzitie: npx ts-node arena-dispatcher.ts "Tvoj prompt"
// alebo:    ARENA_CDP_ENDPOINT=ws://localhost:9222 npx ts-node arena-dispatcher.ts "..."

if (require.main === module) {
  const promptArg = process.argv[2];
  if (!promptArg) {
    console.error('Pouzitie: ts-node arena-dispatcher.ts "Tvoj prompt"');
    process.exit(1);
  }

  void (async () => {
    let browser: Browser | null = null;
    try {
      browser = await chromium.connectOverCDP(CDP_ENDPOINT);
      const contexts = browser.contexts();
      if (!contexts.length) throw new Error("Ziadny Chrome kontext nebol najdeny.");

      const pages = contexts[0].pages();
      const arenaOrigin = ARENA_AGENT_URL.replace("/agent", "");
      let page: Page = pages.find((p) => p.url().startsWith(arenaOrigin)) ?? await contexts[0].newPage();
      if (!page.url().startsWith(arenaOrigin)) {
        await page.goto(ARENA_AGENT_URL, { waitUntil: "domcontentloaded" });
      }

      const result = await dispatchToArena(page, promptArg);

      if (result.ok) {
        console.log("Dispatch uspesny!");
        console.log(`  arena_session_id : ${result.arenaSessionId}`);
        console.log(`  URL              : ${result.arenaUrl}`);
        console.log(`  Detail           : ${result.message}`);
      } else {
        console.error("Dispatch zlyhal:", result.message);
        process.exit(2);
      }
    } finally {
      await browser?.close();
    }
  })();
}
