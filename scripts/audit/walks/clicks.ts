/**
 * RUN: clicks - the crawler. On every room it enumerates EVERY visible enabled clickable
 * (buttons, role=button, menu items) and clicks each one, watching for an observable effect:
 * DOM mutation, a dialog/overlay appearing, navigation, or a status-line change. A click with no
 * observed effect is ledgered as a dead-click SUSPECT (some no-ops are legitimate - re-clicking
 * an active tab - so this list feeds eyeballs, not auto-fail). Recovery after each click:
 * Escape + dismissing known confirms. Blocklist: controls that would kill the server mid-run
 * (Quit/Restart) or leave the page. Runs once per theme.
 */
import { makeRig } from "./shared";

const rig = await makeRig("clicks", process.env.AUDIT_URL ?? "http://127.0.0.1:8331");

const BLOCK = /really |quit hoplight|restart hoplight|open hoplight|github|releases|view release/i;

interface Clickable {
  index: number;
  label: string;
}

const enumerate = async (): Promise<Clickable[]> =>
  rig.page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button'], [role='menuitem']"),
    );
    const out: { index: number; label: string }[] = [];
    els.forEach((el, index) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || s.visibility === "hidden" || s.display === "none") return;
      if ((el as HTMLButtonElement).disabled) return;
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
      out.push({ index, label });
    });
    return out;
  });

let chooserOpened = false;
rig.page.on("filechooser", (fc) => {
  chooserOpened = true;
  void fc.setFiles([]);
});
const fingerprint = async (): Promise<string> =>
  rig.page.evaluate(() => {
    const dialogs = document.querySelectorAll("[role='dialog'], dialog, [class*='overlay'], [class*='sheet']").length;
    const status = document.querySelector("#status")?.textContent ?? "";
    const url = location.href;
    const nodes = document.querySelectorAll("body *").length;
    const dock = document.querySelector("#dock")?.className ?? "";
    const aria = Array.from(document.querySelectorAll("[aria-pressed],[aria-checked],[aria-expanded]"))
      .map((el) => `${el.getAttribute("aria-pressed")}${el.getAttribute("aria-checked")}${el.getAttribute("aria-expanded")}`)
      .join("");
    return `${url}|${dialogs}|${status}|${nodes}|${dock}|${aria}`;
  });

const clickByIndex = async (index: number): Promise<void> => {
  await rig.page.evaluate((i) => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button'], [role='menuitem']"),
    );
    els[i]?.click();
  }, index);
};

const recover = async (): Promise<void> => {
  const keep = rig.page.getByRole("button", { name: /^(Keep|Not now|CANCEL)$/i }).first();
  if (await keep.isVisible().catch(() => false)) await keep.click({ timeout: 1500 }).catch(() => {});
  await rig.page.keyboard.press("Escape").catch(() => {});
};

for (const pass of rig.passes) {
  const apps = await rig.dockApps();
  for (const title of apps) {
    const safeTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!(await rig.openApp(new RegExp(safeTitle, "i")))) continue;
    const room = title.toLowerCase().replace(/\W+/g, "-");
    const list = await enumerate();
    console.log(`[${rig.theme}] ${room}: ${list.length} clickables`);
    let dead = 0;
    for (const c of list) {
      if (BLOCK.test(c.label)) continue;
      // re-enumerate drift guard: click by CURRENT index only if the label still matches
      const now = await enumerate();
      const target = now.find((n) => n.index === c.index && n.label === c.label) ?? now.find((n) => n.label === c.label);
      if (!target) continue;
      const before = await fingerprint();
      chooserOpened = false;
      await clickByIndex(target.index);
      await rig.page.waitForTimeout(350);
      const after = await fingerprint();
      if (before === after && !chooserOpened) {
        dead++;
        rig.ledger.push({
          page: `${room}`,
          theme: rig.theme,
          kind: "dead-click-suspect",
          detail: `"${c.label}" clicked, nothing observable changed`,
        });
      }
      await recover();
      // a click may have navigated rooms; walk home to this room again
      if (!(await rig.page.getByRole("button", { name: new RegExp(safeTitle, "i") }).first().isVisible().catch(() => false))) {
        await rig.page.goto(rig.page.url()).catch(() => {});
        await rig.settle(900);
      }
      await rig.openApp(new RegExp(safeTitle, "i"));
    }
    rig.visited.push(`${rig.theme}/clicks-${room} (${list.length} clickables, ${dead} suspects)`);
  }
  if (pass === 1 && rig.passes.length > 1) await rig.flipTheme();
}

process.exit((await rig.finish("clicks")) > 0 ? 1 : 0);
