/**
 * RUN: library - every deck x every view (both read from the live chip/switch rows), the staging
 * bar, the delete confirm (dismissed), and the context menu. Both themes.
 */
import { makeRig } from "./shared";

const rig = await makeRig("library", process.env.AUDIT_URL ?? "http://127.0.0.1:8331");

for (const pass of rig.passes) {
  await rig.openApp(/The Library/i);
  const decks = await rig.buttonNames(".deckchips");
  console.log(`[${rig.theme}] decks: ${decks.join(" · ")}`);
  for (const deck of decks) {
    await rig.page.getByRole("button", { name: new RegExp(deck.replace(/\d+$/, "").trim(), "i") }).first().click().catch(() => {});
    await rig.settle(600);
    const views = await rig.buttonNames(".viewseg");
    for (const view of views) {
      await rig.page.getByRole("button", { name: new RegExp(`^${view}$`, "i") }).first().click().catch(() => {});
      await rig.settle(600);
      await rig.stop(`library-${deck.replace(/\d+$/, "").trim().toLowerCase().replace(/\W+/g, "-")}-${view.toLowerCase()}`);
    }
  }

  // staging bar + delete confirm on the first deck (Keep pressed - nothing deleted)
  const first = decks[0]?.replace(/\d+$/, "").trim();
  if (first) {
    await rig.page.getByRole("button", { name: new RegExp(first, "i") }).first().click().catch(() => {});
    await rig.settle(500);
    const selAll = rig.page.getByRole("button", { name: /^Select all$/i }).first();
    if (await selAll.isVisible().catch(() => false)) {
      await selAll.click();
      await rig.settle(400);
      await rig.stop("library-staging-bar");
      const del = rig.page.getByRole("button", { name: /^Delete (it|all \d+)$/i }).first();
      if (await del.isVisible().catch(() => false)) {
        await del.click();
        await rig.settle(400);
        await rig.stop("library-delete-confirm");
        await rig.page.getByRole("button", { name: /^Keep$/ }).click().catch(() => {});
      }
      await rig.page.getByRole("button", { name: /^Clear$/i }).first().click().catch(() => {});
    }
    // the right-click menu
    const card = rig.page.locator(".dv-gcard, .dv-book, .dv-show .plate").first();
    if (await card.isVisible().catch(() => false)) {
      await card.click({ button: "right" }).catch(() => {});
      await rig.settle(400);
      await rig.stop("library-context-menu");
      await rig.page.keyboard.press("Escape");
    }
  }
  if (pass === 1 && rig.passes.length > 1) await rig.flipTheme();
}

process.exit((await rig.finish("library")) > 0 ? 1 : 0);
