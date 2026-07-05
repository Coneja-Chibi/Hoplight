/**
 * Setup step: house accent ("Pick your color."). A thin consumer of the shared swatch component
 * (src/ui/_shared/swatches.ts) - the same picker Settings and the editor's per-entity accent will
 * reuse. Swatches repaint --accent on the STAGE ONLY during setup (and the house chrome after
 * OPEN VAUDE) - never the brand rose mark or CTAs (DECISIONS #3).
 * Writes SETTING_KEYS.houseAccent (the hex, directly usable as the --accent token).
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { HOUSE_PALETTE, SWATCH_CSS, swatchButton } from "../../../_shared/swatches";
import type { SetupDraft, SetupOption, SetupStep } from "../../step-contract";

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
  css: SWATCH_CSS,
  options: () => OPTIONS,
  renderOption(opt) {
    return swatchButton({ id: opt.id, label: opt.title, hex: String(opt.value) });
  },
  applyStage(stageRoot: HTMLElement, draft: SetupDraft) {
    const hex = draft[SETTING_KEYS.houseAccent];
    if (typeof hex === "string") stageRoot.style.setProperty("--accent", hex);
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
