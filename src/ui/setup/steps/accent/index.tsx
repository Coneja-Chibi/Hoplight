/**
 * Setup step: house accent ("Pick your color."). A thin consumer of the shared SwatchRow
 * component (src/ui/components/swatch-row/) - the same picker Settings and the editor's
 * per-entity accent reuse. Swatches repaint --accent on the STAGE ONLY during setup (and the
 * house chrome after OPEN VAUDE) - never the brand rose mark or CTAs (DECISIONS #3).
 * Writes SETTING_KEYS.houseAccent (the hex, directly usable as the --accent token).
 *
 * DEPENDENCY (flagged): SwatchRow is being built in parallel by the settings-conversion agent
 * under src/ui/components/swatch-row/. This file assumes a controlled contract - palette in,
 * value in, onChange(hex) out - mirroring the vanilla swatchRow() this replaces (_shared/swatches.ts),
 * MINUS its allowCustom door: the setup accent step never offered a custom color (only Settings and
 * the editor did), so parity with the vanilla step is a plain palette + value + onChange, no
 * allowCustom. If src/ui/components/swatch-row does not exist yet, or its real props differ, this
 * import is a known, owned tsc error scoped to this one file - it does not block any other surface.
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
        onChange={(hex: string) => {
          const picked = options.find((o) => o.value === hex);
          if (picked) onPick(picked);
        }}
      />
    );
  },
  stageVars(draft) {
    const hex = draft[SETTING_KEYS.houseAccent];
    return typeof hex === "string" ? { "--accent": hex } : undefined;
  },
  phrase(draft, options) {
    const picked = options.find((o) => o.value === draft[SETTING_KEYS.houseAccent]);
    return picked ? { pre: "in ", strong: picked.title } : null;
  },
  recap(draft, options) {
    const picked = options.find((o) => o.value === draft[SETTING_KEYS.houseAccent]);
    return picked ? { label: "color", value: picked.title } : null;
  },
};

export default step;
