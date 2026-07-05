/**
 * Settings section: Appearance - theme + house accent. Both apply LIVE on pick (call and
 * response through ctx.prefs; the shell repaints). The accent uses the shared swatch component
 * (the same picker the setup wizard uses; entity accents get their own in the editor).
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { HOUSE_PALETTE, swatchRow } from "../../../_shared/swatches";
import { h, row, segControl, type SettingsSection } from "../section-contract";

const section: SettingsSection = {
  id: "appearance",
  label: "Appearance",
  order: 10,
  render(ctx, host) {
    const theme = ctx.prefs.get(SETTING_KEYS.theme);
    host.append(
      row(
        "Theme",
        "Light paper or the dark forge. Flips instantly.",
        segControl(
          [
            { value: "paper", label: "Light" },
            { value: "stage", label: "Dark" },
          ],
          theme === "stage" ? "stage" : "paper",
          (v) => {
            ctx.prefs.set(SETTING_KEYS.theme, v);
            rerender(ctx, host);
          },
        ),
      ),
    );

    const accent = ctx.prefs.get(SETTING_KEYS.houseAccent);
    const swatches = swatchRow({
      palette: HOUSE_PALETTE,
      value: typeof accent === "string" ? accent : undefined,
      onPick: (choice) => ctx.prefs.set(SETTING_KEYS.houseAccent, choice.hex),
      allowCustom: true,
    });
    const swatchHost = h("div");
    swatchHost.style.paddingTop = ".4rem";
    swatchHost.append(swatches.root);
    host.append(row("Your color", "The workspace accent. The brand rose never changes.", swatchHost));
  },
};

function rerender(ctx: Parameters<SettingsSection["render"]>[0], host: HTMLElement): void {
  host.replaceChildren();
  void section.render(ctx, host);
}

export default section;
