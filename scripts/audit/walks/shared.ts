/**
 * The shared walk rig (runs under NODE - bun's own CDP pipe hangs against chromium). Owns the
 * browser, the settle/skip/theme plumbing, RUNTIME ENUMERATION (dock apps, tab groups, select
 * options - the walks grow with the app because they read the live page, never a hand list),
 * the ledger, and the artifact folders under audit-out/<run>/.
 */
import { chromium, type Browser, type Page } from "playwright-core";
import { readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auditPage, type AuditResult } from "../page-audit";

export interface Finding {
  page: string;
  theme: string;
  kind: string;
  detail: string;
}

export interface Rig {
  page: Page;
  browser: Browser;
  ledger: Finding[];
  visited: string[];
  theme: string;
  /** [1,2] normally (dark then light); [1] when AUDIT_THEME pins a single-theme run */
  passes: number[];
  out: string;
  settle(ms?: number): Promise<void>;
  skip(): Promise<void>;
  /** audit + screenshot the current state under this stop name */
  stop(name: string): Promise<void>;
  /** click a dock/app button by accessible name and settle */
  openApp(name: RegExp): Promise<boolean>;
  /** every dock app title, read from the live dock (auto-grows with dropped-in apps) */
  dockApps(): Promise<string[]>;
  /** force the Library onto the grid view (view prefs persist across walks; grid is the anchor) */
  ensureGridView(): Promise<void>;
  /** accessible names of a button group under a container selector (tabs, view switches) */
  buttonNames(containerSelector: string): Promise<string[]>;
  /** values of a <select> by accessible label (lens enumeration) */
  selectValues(label: string): Promise<string[]>;
  flipTheme(): Promise<void>;
  finish(runName: string): Promise<number>;
}

function chromePath(): string {
  const override = process.env.PLAYWRIGHT_CHROMIUM;
  if (override && existsSync(override)) return override;
  const root = join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  const revs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const dir of revs) {
    for (const sub of ["chrome-win64", "chrome-win"]) {
      const p = join(root, dir, sub, "chrome.exe");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("audit: no chromium found; set PLAYWRIGHT_CHROMIUM");
}

export async function makeRig(runName: string, url: string): Promise<Rig> {
  const out = join(process.cwd(), "audit-out", runName);
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const ledger: Finding[] = [];
  const visited: string[] = [];
  const pinned = process.env.AUDIT_THEME;
  const rig: Rig = {
    page,
    browser,
    ledger,
    visited,
    theme: "dark",
    passes: pinned ? [1] : [1, 2],
    out,
    async settle(ms = 800) {
      await page.waitForTimeout(ms);
    },
    async skip() {
      const s = page.getByRole("button", { name: /^skip$/i }).first();
      if (await s.isVisible().catch(() => false)) await s.click({ timeout: 1500 }).catch(() => {});
    },
    async stop(name) {
      await rig.skip();
      const res = (await page.evaluate(auditPage)) as AuditResult;
      for (const d of res.tinyText) ledger.push({ page: name, theme: rig.theme, kind: "tiny-text", detail: d });
      for (const d of res.lowContrast) ledger.push({ page: name, theme: rig.theme, kind: "low-contrast", detail: d });
      for (const d of res.nakedControls) ledger.push({ page: name, theme: rig.theme, kind: "naked-control", detail: d });
      visited.push(`${rig.theme}/${name}`);
      await page.screenshot({ path: join(out, `${rig.theme}-${name}.png`) });
      console.log(
        `[${rig.theme}] ${name}: tiny=${res.tinyText.length} contrast=${res.lowContrast.length} naked=${res.nakedControls.length}`,
      );
    },
    async openApp(name) {
      const b = page.getByRole("button", { name }).first();
      if (!(await b.isVisible().catch(() => false))) return false;
      await b.click({ timeout: 5000 }).catch(() => {});
      await rig.settle();
      await rig.skip();
      return true;
    },
    async dockApps() {
      return page.evaluate(() => {
        const dock = document.querySelector("#dock");
        if (!dock) return [];
        return Array.from(dock.querySelectorAll<HTMLElement>("button"))
          .map((b) => (b.getAttribute("aria-label") ?? b.innerText ?? "").trim().split("\n")[0]!.trim())
          .filter((t) => t.length > 1 && !/collapse|add app|^home$|settings gear/i.test(t) && !/^hoplight\.?$/i.test(t));
      });
    },
    async ensureGridView() {
      const grid = page.getByRole("button", { name: /^GRID$/i }).first();
      if (await grid.isVisible().catch(() => false)) {
        await grid.click({ timeout: 2000 }).catch(() => {});
        await rig.settle(500);
      }
    },
    async buttonNames(containerSelector) {
      return page.evaluate((sel) => {
        const box = document.querySelector(sel);
        if (!box) return [];
        return Array.from(box.querySelectorAll("button"))
          .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim())
          .filter((t) => t.length > 0);
      }, containerSelector);
    },
    async selectValues(label) {
      const sel = page.getByLabel(label);
      if (!(await sel.isVisible().catch(() => false))) return [];
      return sel.evaluate((el) => Array.from((el as HTMLSelectElement).options).map((o) => o.value));
    },
    async flipTheme() {
      await page.getByLabel("Switch theme").click({ timeout: 4000 }).catch(() => {});
      await rig.settle(600);
      rig.theme = rig.theme === "dark" ? "light" : "dark";
    },
    async finish(run) {
      writeFileSync(join(out, "ledger.json"), JSON.stringify({ visited, findings: ledger }, null, 1));
      const counts: Record<string, number> = {};
      for (const f of ledger) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
      console.log(`${run}: ${visited.length} states walked · findings ${JSON.stringify(counts)}`);
      await browser.close();
      return ledger.length;
    },
  };
  page.on("pageerror", (e) =>
    ledger.push({ page: "GLOBAL", theme: rig.theme, kind: "page-error", detail: e.message.slice(0, 160) }),
  );
  await page.goto(url);
  await rig.settle(1800);
  await rig.skip();
  if (pinned === "light") await rig.flipTheme(); // the seeded studio boots dark
  return rig;
}
