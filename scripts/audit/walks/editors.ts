/**
 * RUN: editors - one piece of every kind opened in its real editor (created through the ghost
 * shelf's New button when the deck is empty, which audits the create flow too). The lorebook
 * editor additionally walks EVERY write-for lens (options read live from the select), all binder
 * views, the export dialog, book rules, and the marinara folder inspector. Both themes.
 */
import { makeRig } from "./shared";

const rig = await makeRig("editors", process.env.AUDIT_URL ?? "http://127.0.0.1:8331");

const rx = (s: string): RegExp => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

async function openFirstOrCreate(deck: string): Promise<boolean> {
  await rig.openApp(/The Library/i);
  await rig.page.getByRole("button", { name: rx(deck) }).first().click().catch(() => {});
  await rig.settle(600);
  await rig.ensureGridView();
  const card = rig.page.locator(".dv-gcard, .dv-book, .dv-show .plate").first();
  if (await card.isVisible().catch(() => false)) {
    await card.click({ button: "right" }).catch(() => {});
    const send = rig.page.getByRole("menuitem", { name: /Send to the Workbench/ });
    if (await send.isVisible().catch(() => false)) await send.click();
    else {
      await rig.page.keyboard.press("Escape");
      await card.click();
      const sendBtn = rig.page.getByRole("button", { name: /Send .* Workbench/i }).first();
      if (await sendBtn.isVisible().catch(() => false)) await sendBtn.click();
    }
  } else {
    const create = rig.page.getByRole("button", { name: /^New /i }).first();
    if (!(await create.isVisible().catch(() => false))) return false;
    await create.click();
  }
  const yes = rig.page.getByRole("button", { name: /^Yes$/ }).first();
  if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
  await rig.settle(1400);
  await rig.skip();
  return true;
}

for (const pass of rig.passes) {
  await rig.openApp(/The Library/i);
  const decks = (await rig.buttonNames(".deckchips")).map((d) => d.replace(/\d+$/, "").trim());
  for (const deck of decks) {
    if (!(await openFirstOrCreate(deck))) { console.log(`[${rig.theme}] editors: no piece and no create for ${deck}, skipped`); continue; }
    const slug = deck.toLowerCase().replace(/\W+/g, "-");
    await rig.stop(`editor-${slug}`);

    // every write-for lens this editor's select offers (the lore binder today; any future one too)
    const lenses = await rig.selectValues("Writing for one host");
    for (const lens of lenses) {
      await rig.page.getByLabel("Writing for one host").selectOption(lens).catch(() => {});
      await rig.settle(600);
      await rig.stop(`editor-${slug}-lens-${lens}`);
      if (lens === "marinara") {
        const folder = rig.page.locator("[class*='mfFolder']").first();
        if (await folder.isVisible().catch(() => false)) {
          await folder.click().catch(() => {});
          await rig.settle(500);
          await rig.stop(`editor-${slug}-folder-inspector`);
        }
      }
    }

    // binder views when offered
    for (const view of ["Cards", "Web", "Pages"]) {
      const b = rig.page.getByRole("button", { name: new RegExp(`^${view}$`) }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        await rig.settle(500);
        await rig.stop(`editor-${slug}-view-${view.toLowerCase()}`);
      }
    }

    // dialogs that announce themselves
    const rules = rig.page.getByRole("button", { name: /book rules/i }).first();
    if (await rules.isVisible().catch(() => false)) {
      await rules.click();
      await rig.settle(500);
      await rig.stop(`editor-${slug}-book-rules`);
      await rig.page.getByLabel(/close book rules/i).click().catch(() => rig.page.keyboard.press("Escape"));
    }
    const exp = rig.page.getByRole("button", { name: /^Export$/i }).first();
    if (await exp.isVisible().catch(() => false)) {
      await exp.click();
      await rig.settle(600);
      await rig.stop(`editor-${slug}-export`);
      await rig.page.getByRole("button", { name: /CANCEL/i }).first().click().catch(() => {});
    }
  }
  if (pass === 1 && rig.passes.length > 1) await rig.flipTheme();
}

process.exit((await rig.finish("editors")) > 0 ? 1 : 0);
