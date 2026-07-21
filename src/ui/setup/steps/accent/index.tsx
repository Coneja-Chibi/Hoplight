/**
 * Setup step: house accent ("Pick your color."). A thin consumer of the shared SwatchRow
 * component (src/ui/components/swatch-row/) - the same picker Settings and the editor's
 * per-entity accent reuse, custom tile included. Swatches repaint --accent on the stage AND
 * the wizard's own selection marks live (--wiz-a) - never the brand rose mark or the CTAs
 * (DECISIONS #3). Writes SETTING_KEYS.houseAccent (the hex, directly usable as --accent).
 */
import type { JSX } from "react";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { HOUSE_PALETTE, SwatchRow } from "../../../components/swatch-row";
import type { SetupOption, SetupStep } from "../../step-contract";

/** The shared palette as wizard options: id = name, value = the stored hex, rose is the default. */
const OPTIONS: SetupOption[] = HOUSE_PALETTE.map((c) => ({
  id: c.id,
  title: c.label,
  value: c.hex,
  isDefault: c.id === "rose",
}));

const step: SetupStep = {
  manifest: {
    id: "accent",
    order: 40,
    question: "Pick your color.",
    say: "One accent for your workspace. Rose is a good place to start.",
    settingsKey: SETTING_KEYS.houseAccent,
    layoutClass: "swatches",
    stageNote: "accent pieces repaint",
  },
  options: () => OPTIONS,
  renderOptions(options, draft, onPick): JSX.Element {
    const value = draft[SETTING_KEYS.houseAccent];
    return (
      <SwatchRow
        palette={HOUSE_PALETTE}
        value={typeof value === "string" ? value : undefined}
        allowCustom
        onChange={(hex: string) => {
          const picked = options.find((o) => o.value === hex);
          // a custom hex has no palette option; carry the value through a synthetic option
          onPick(picked ?? { id: "custom", title: "Custom", value: hex });
        }}
      />
    );
  },
  stageVars(draft) {
    const hex = draft[SETTING_KEYS.houseAccent];
    return typeof hex === "string" ? { "--accent": hex } : undefined;
  },
  // the wizard's own selection marks follow the pick live; brand mark + CTAs stay rose
  pageVars(draft) {
    const hex = draft[SETTING_KEYS.houseAccent];
    return typeof hex === "string" ? { "--wiz-a": hex } : undefined;
  },
  phrase(draft, options) {
    const hex = draft[SETTING_KEYS.houseAccent];
    if (typeof hex !== "string") return null;
    const picked = options.find((o) => o.value === hex);
    return { pre: "in ", strong: picked ? picked.title : "your own color" };
  },
  recap(draft, options) {
    const hex = draft[SETTING_KEYS.houseAccent];
    if (typeof hex !== "string") return null;
    const picked = options.find((o) => o.value === hex);
    return { label: "color", value: picked ? picked.title : hex };
  },
};

export default step;
