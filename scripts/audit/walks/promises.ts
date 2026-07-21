/**
 * RUN: promises - buttons must DO what they say. Each entry is act -> observable effect; a miss
 * lands in the ledger as promise-broken. THIS TABLE IS THE ONE HAND-GROWN PART of the audit
 * suite: behavior expectations are human knowledge, so new features add a row here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeRig } from "./shared";

const rig = await makeRig("promises", process.env.AUDIT_URL ?? "http://127.0.0.1:8331");
const CARD = readFileSync(
  join(process.cwd(), "samples", "sillytavern", "characters", "v3-full.json"),
  "utf8",
);

let passCount = 0;
let failCount = 0;
async function promise(name: string, fn: () => Promise<boolean>): Promise<void> {
  let ok = false;
  let err = "";
  try {
    ok = await fn();
  } catch (e) {
    err = e instanceof Error ? e.message.slice(0, 120) : String(e);
  }
  if (ok) passCount++;
  else {
    failCount++;
    rig.ledger.push({ page: name, theme: rig.theme, kind: "promise-broken", detail: err || "expected effect not observed" });
  }
  rig.visited.push(`promise/${name}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${err ? ` (${err})` : ""}`);
}

const deckCount = async (deck: RegExp): Promise<number> => {
  await rig.openApp(/The Library/i);
  const chip = rig.page.getByRole("button", { name: deck }).first();
  const txt = (await chip.innerText().catch(() => "")).trim();
  const m = txt.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
};

await promise("theme-toggle-flips-the-page", async () => {
  const before = await rig.page.evaluate(() => document.documentElement.dataset.theme);
  await rig.page.evaluate(() => (document.querySelector("#themeBtn") as HTMLElement | null)?.click());
  await rig.settle(500);
  const after = await rig.page.evaluate(() => document.documentElement.dataset.theme);
  await rig.page.evaluate(() => (document.querySelector("#themeBtn") as HTMLElement | null)?.click());
  await rig.settle(400);
  return before !== after && !!after;
});

await promise("import-button-opens-a-file-picker", async () => {
  let chooser = false;
  rig.page.once("filechooser", (fc) => {
    chooser = true;
    void fc.setFiles([]);
  });
  await rig.page.getByRole("button", { name: /^Import$/i }).first().click();
  await rig.settle(1200);
  return chooser;
});

await promise("dragging-files-raises-the-veil", async () => {
  await rig.openApp(/The Workbench/i);
  await rig.page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "x.json", { type: "application/json" }));
    document.body.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await rig.settle(300);
  const veil = await rig.page.locator("#dropveil").isVisible().catch(() => false);
  await rig.page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "x.json", { type: "application/json" }));
    document.body.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  return veil;
});

await promise("dropping-a-file-imports-it-and-the-count-rises", async () => {
  const before = await deckCount(/Characters/i);
  await rig.openApp(/The Workbench/i);
  await rig.page.evaluate((card) => {
    const dt = new DataTransfer();
    dt.items.add(new File([card], "walk-drop.json", { type: "application/json" }));
    document.body.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, CARD);
  await rig.settle(1600);
  const imp = rig.page.getByRole("button", { name: /^import \d+$/i }).first();
  if (!(await imp.isVisible().catch(() => false))) return false;
  await imp.click({ force: true, timeout: 4000 }).catch(() => {});
  await rig.settle(1400);
  return (await deckCount(/Characters/i)) === before + 1;
});

await promise("select-all-stages-the-shelf", async () => {
  await rig.openApp(/The Library/i);
  await rig.page.getByRole("button", { name: /Characters/i }).first().click();
  await rig.settle(500);
  const selAll = rig.page.getByRole("button", { name: /^Select all$/i }).first();
  if (!(await selAll.isVisible().catch(() => false))) return false;
  await selAll.click();
  await rig.settle(400);
  const bar = await rig.page.getByText(/pieces? staged/i).first().isVisible().catch(() => false);
  await rig.page.getByRole("button", { name: /^Clear$/i }).first().click().catch(() => {});
  return bar;
});

await promise("delete-actually-deletes", async () => {
  await rig.openApp(/The Library/i);
  const before = await deckCount(/Characters/i);
  if (before === 0) return false;
  await rig.page.getByRole("button", { name: /Characters/i }).first().click();
  await rig.settle(400);
  await rig.ensureGridView();
  const card = rig.page.locator(".dv-gcard, .dv-book, .dv-show .plate").first();
  await card.click({ button: "right" });
  await rig.page.getByRole("menuitem", { name: /Delete from the studio/i }).click();
  await rig.settle(400);
  await rig.page.getByRole("button", { name: /^Delete$/ }).click();
  await rig.settle(1200);
  return (await deckCount(/Characters/i)) === before - 1;
});

await promise("send-to-workbench-opens-a-tab", async () => {
  await rig.openApp(/The Library/i);
  await rig.page.getByRole("button", { name: /Characters/i }).first().click();
  await rig.settle(400);
  await rig.ensureGridView();
  const card = rig.page.locator(".dv-gcard, .dv-book, .dv-show .plate").first();
  if (!(await card.isVisible().catch(() => false))) return false;
  const sentName = ((await card.innerText().catch(() => "")).split("\n")[0] ?? "").trim();
  await card.click({ button: "right" });
  await rig.page.getByRole("menuitem", { name: /Send to the Workbench/ }).click();
  const yes = rig.page.getByRole("button", { name: /^Yes$/ }).first();
  if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
  await rig.settle(1400);
  // following must land ON the sent piece: the ACTIVE tab wears its name (a Yes that left the
  // old tab focused poisoned every editors-walk measurement for eight passes)
  const active = (await rig.page.locator("#tabstrip .tab.active").first().innerText().catch(() => "")).trim();
  return sentName.length > 0 && active.includes(sentName);
});

await promise("lens-switch-visibly-changes-the-binder", async () => {
  // earlier promises leave pieces open; a cluttered workbench changes the binder's layout, so
  // this test owns a clean bench (state coupling burned this check twice)
  await rig.page.evaluate(() => {
    for (const x of Array.from(document.querySelectorAll<HTMLElement>("#tabstrip .tab .close"))) x.click();
  });
  await rig.settle(600);
  await rig.openApp(/The Library/i);
  await rig.page.getByRole("button", { name: /Lorebooks/i }).first().click();
  await rig.settle(400);
  await rig.ensureGridView();
  const card = rig.page.locator(".dv-gcard, .dv-book, .dv-show .plate").first();
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.click({ button: "right" });
  await rig.page.getByRole("menuitem", { name: /Send to the Workbench/ }).click();
  const yes = rig.page.getByRole("button", { name: /^Yes$/ }).first();
  if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
  await rig.settle(1400);
  await rig.skip();
  const lens = rig.page.getByLabel("Writing for one host");
  if (!(await lens.isVisible().catch(() => false))) return false;
  await lens.selectOption("marinara");
  await rig.settle(1200);
  const landed = (await lens.inputValue().catch(() => "")) === "marinara";
  const furniture = await rig.page
    .locator("[class*='mfFolder'], [class*='mfDropStrip'], [class*='mfAddRow']")
    .first()
    .isVisible()
    .catch(() => false);
  return landed && furniture;
});

await promise("check-for-updates-answers", async () => {
  await rig.openApp(/Settings/i);
  await rig.page.getByRole("button", { name: /^About$/i }).first().click();
  await rig.settle(500);
  await rig.page.getByRole("button", { name: /Check for updates/i }).click();
  await rig.settle(4000);
  const line = (await rig.page.getByRole("status").last().innerText().catch(() => "")).trim();
  return line.length > 0; // any honest answer counts; silence is the broken promise
});

await promise("search-filters-the-shelf", async () => {
  await rig.openApp(/The Library/i);
  await rig.page.getByRole("button", { name: /Characters/i }).first().click();
  await rig.settle(400);
  const shelfBtn = rig.page.getByRole("button", { name: /^SHELF$/i }).first();
  if (await shelfBtn.isVisible().catch(() => false)) await shelfBtn.click();
  await rig.settle(500);
  const find = rig.page.getByLabel(/Search by name, key, or tag/i).first();
  if (!(await find.isVisible().catch(() => false))) return false;
  await find.fill("zzz-no-such-piece-zzz");
  await rig.settle(500);
  const empty = await rig.page.getByText(/Nothing matches/i).first().isVisible().catch(() => false);
  await find.fill("");
  return empty;
});

await promise("new-button-creates-a-piece", async () => {
  const before = await deckCount(/Personas/i);
  await rig.page.getByRole("button", { name: /Personas/i }).first().click();
  await rig.settle(500);
  const create = rig.page.getByRole("button", { name: /New persona/i }).first();
  if (!(await create.isVisible().catch(() => false))) return false;
  await create.click();
  await rig.settle(1600);
  return (await deckCount(/Personas/i)) === before + 1;
});

// duplicate + rename chain on the persona the create test just made: the created piece is OPEN
// on the Workbench (duplicate works on open pieces; rename refuses them), so duplicate first and
// rename the freshly minted CLOSED sibling. Self-owned subjects; the battered character deck
// earlier tests chew through is not a fair witness. Card lookups scope INSIDE the library pane
// (.lib) - a bare page-wide name match resolves to the piece's Workbench TAB first (burned once).
await promise("duplicate-mints-a-sibling", async () => {
  const before = await deckCount(/Personas/i);
  if (before === 0) return false;
  await rig.page.getByRole("button", { name: /Personas/i }).first().click();
  await rig.settle(500);
  // name-based, view-agnostic: persona decks use their own shelf view with different classes
  const card = rig.page.locator(".lib").getByRole("button", { name: /Untitled persona/i }).first();
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.click({ button: "right" });
  await rig.page.getByRole("menuitem", { name: /^Duplicate$/ }).click({ timeout: 5000 });
  await rig.settle(1400);
  return (await deckCount(/Personas/i)) === before + 1;
});

await promise("rename-sticks", async () => {
  // open pieces refuse rename, and shelf order decides which card a name match hits - close the
  // bench first (the lens-switch precedent) so EVERY persona card is a fair rename target
  await rig.page.evaluate(() => {
    for (const x of Array.from(document.querySelectorAll<HTMLElement>("#tabstrip .tab .close"))) x.click();
  });
  await rig.settle(600);
  await rig.openApp(/The Library/i);
  await rig.page.getByRole("button", { name: /Personas/i }).first().click();
  await rig.settle(500);
  const card = rig.page.locator(".lib").getByRole("button", { name: /Untitled persona/i }).last();
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.click({ button: "right" });
  await rig.page.getByRole("menuitem", { name: /^Rename$/ }).click({ timeout: 5000 });
  await rig.settle(400);
  const input = rig.page.getByLabel("New name");
  if (!(await input.isVisible().catch(() => false))) return false;
  await input.fill("Walk Renamed");
  await rig.page.getByRole("button", { name: /^Rename$/ }).click();
  await rig.settle(1200);
  return rig.page.getByText("Walk Renamed").first().isVisible().catch(() => false);
});

await promise("getting-started-tour-tells-the-truth-and-really-highlights", async () => {
  // deterministic state: clear the bench so the tour's open act takes the "opened one of yours"
  // branch (the seeded library has characters). The walk rig's own skip() would dismiss the rail,
  // so no openApp/skip calls happen after the replay button is pressed.
  await rig.openApp(/The Workbench/i);
  await rig.page.evaluate(() => {
    for (const x of Array.from(document.querySelectorAll<HTMLElement>("#tabstrip .tab .close"))) x.click();
  });
  await rig.settle(600);
  await rig.page.getByRole("button", { name: /Replay the tour/i }).click({ timeout: 5000 });
  await rig.settle(500);
  const rail = rig.page.getByRole("dialog", { name: /tour/i });
  if (!(await rail.isVisible().catch(() => false))) return false;
  await rail.getByRole("button", { name: /^Next$/ }).click(); // welcome -> open step
  await rig.settle(1200);
  const openText = (await rail.innerText().catch(() => "")).trim();
  // the narration must match what actually happened: bench was empty, library had characters
  if (!openText.includes("I opened one of your characters")) return false;
  await rail.getByRole("button", { name: /^Next$/ }).click(); // -> layout step
  await rig.settle(1200);
  // the honest-highlight law: an anchored step either LIGHTS a real element or says it cannot
  const state = await rig.page.evaluate(() => ({
    highlighted: document.querySelectorAll(".tourHl").length,
    admitsMissing: /not on this screen right now/i.test(
      document.querySelector("[role=dialog][aria-label*='tour' i]")?.textContent ?? "",
    ),
  }));
  await rail.getByRole("button", { name: /^skip$/i }).click().catch(() => {});
  return state.highlighted > 0 && !state.admitsMissing;
});

console.log(`promises: ${passCount} kept, ${failCount} broken`);
process.exit((await rig.finish("promises")) > 0 ? 1 : 0);
