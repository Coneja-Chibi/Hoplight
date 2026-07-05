/**
 * Settings section: Studio - the home app (which room opens on start), the first deck the
 * Library shows, and the publish targets (data-driven from the live format registry, exactly
 * like the setup wizard's plates). Every "change it later" promise from setup lands here.
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { knownDecks } from "../../../_shared/decks";
import { h, row, segControl, type SettingsSection } from "../section-contract";

const section: SettingsSection = {
  id: "studio",
  label: "Studio",
  order: 20,
  async render(ctx, host) {
    // home app: any real dock app can be home
    const apps = ctx.apps().filter((m) => !m.comingSoon && !m.dockFoot);
    const home = ctx.prefs.get(SETTING_KEYS.homeApp);
    host.append(
      row(
        "Home",
        "The room Vaude opens in when you start it.",
        segControl(
          apps.map((m) => ({ value: m.id, label: m.title.replace(/^The /, "") })),
          typeof home === "string" && apps.some((m) => m.id === home) ? home : (apps[0]?.id ?? ""),
          (v) => {
            ctx.prefs.set(SETTING_KEYS.homeApp, v);
            redo(ctx, host);
          },
        ),
      ),
    );

    // first deck: which shelf the Library opens on
    const firstDeck = ctx.prefs.get(SETTING_KEYS.firstDeck);
    host.append(
      row(
        "Library opens on",
        "The deck you see first when you visit the shelves.",
        segControl(
          knownDecks().map((d) => ({ value: d.kind, label: d.plural })),
          typeof firstDeck === "string" && firstDeck ? firstDeck : "character",
          (v) => {
            ctx.prefs.set(SETTING_KEYS.firstDeck, v);
            redo(ctx, host);
          },
        ),
      ),
    );

    // publish targets: same data-driven plates as setup (platforms from the registry, never a list)
    const formats = await ctx.api.formats();
    const platforms = [...new Set(formats.filter((f) => !f.native).map((f) => f.friendly))].sort((a, b) =>
      a.localeCompare(b),
    );
    const picked = new Set(
      Array.isArray(ctx.prefs.get(SETTING_KEYS.publishTargets))
        ? (ctx.prefs.get(SETTING_KEYS.publishTargets) as string[])
        : [],
    );
    const plates = h("div", "set-plates");
    for (const p of platforms) {
      const b = h("button", `set-plate${picked.has(p) ? " on" : ""}`, p);
      b.addEventListener("click", () => {
        if (picked.has(p)) picked.delete(p);
        else picked.add(p);
        ctx.prefs.set(SETTING_KEYS.publishTargets, [...picked]);
        redo(ctx, host);
      });
      plates.append(b);
    }
    host.append(row("You publish to", "Pick any that fit. Every format stays ready either way.", plates));
  },
};

function redo(ctx: Parameters<SettingsSection["render"]>[0], host: HTMLElement): void {
  host.replaceChildren();
  void section.render(ctx, host);
}

export default section;
