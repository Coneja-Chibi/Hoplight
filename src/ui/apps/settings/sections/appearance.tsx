/**
 * Settings section: Appearance - theme + house accent. Both apply LIVE on pick (call and
 * response through ctx.prefs; the shell repaints). The accent uses the shared SwatchRow (the same
 * picker the setup wizard uses; entity accents get their own in the editor).
 */
import { useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { HOUSE_PALETTE, SwatchRow } from "../../../components/swatch-row";
import { SegControl, SettingsRow, type SettingsSection } from "../section-contract";

type Theme = "paper" | "stage";

function AppearanceSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => (ctx.prefs.get(SETTING_KEYS.theme) === "stage" ? "stage" : "paper"));
  const [accent, setAccent] = useState<string | undefined>(() => {
    const a = ctx.prefs.get(SETTING_KEYS.houseAccent);
    return typeof a === "string" ? a : undefined;
  });

  return (
    <>
      <SettingsRow label="Theme" hint="Light paper or the dark forge. Flips instantly.">
        <SegControl<Theme>
          options={[
            { value: "paper", label: "Light" },
            { value: "stage", label: "Dark" },
          ]}
          current={theme}
          onPick={(v) => {
            ctx.prefs.set(SETTING_KEYS.theme, v);
            setTheme(v);
          }}
        />
      </SettingsRow>
      <SettingsRow label="Your color" hint="The workspace accent. The brand rose never changes.">
        <SwatchRow
          palette={HOUSE_PALETTE}
          value={accent}
          allowCustom
          onChange={(hex) => {
            ctx.prefs.set(SETTING_KEYS.houseAccent, hex);
            setAccent(hex);
          }}
        />
      </SettingsRow>
    </>
  );
}

const section: SettingsSection = {
  id: "appearance",
  label: "Appearance",
  order: 10,
  Component: AppearanceSection,
};

export default section;
