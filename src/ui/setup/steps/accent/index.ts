/**
 * Setup step: house accent ("Pick your color."). Swatches repaint --accent on the STAGE ONLY
 * during setup (and the house chrome after OPEN VAUDE) - never the brand rose mark or CTAs
 * (DECISIONS #3). Swatch names + hexes are the authored design palette from the locked artifact.
 * Writes SETTING_KEYS.houseAccent (the hex, directly usable as the --accent token).
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import type { SetupDraft, SetupOption, SetupStep } from "../../step-contract";

/** The authored palette (locked vs-setup-hybrid): id = name, value = the stored hex. */
const OPTIONS: SetupOption[] = [
  { id: "rose", title: "rose", value: "#e11d48", isDefault: true },
  { id: "amber", title: "amber", value: "#f59e0b" },
  { id: "emerald", title: "emerald", value: "#10b981" },
  { id: "violet", title: "violet", value: "#8b5cf6" },
  { id: "blue", title: "blue", value: "#3b82f6" },
];

const CSS = `
.swatches{display:flex;gap:.9rem;flex-wrap:wrap;justify-content:flex-start;padding:.4rem 0 1.9rem}
.sw{width:clamp(3rem,8vw,3.5rem);aspect-ratio:1;border:3px solid var(--ink);cursor:pointer;
  position:relative;box-shadow:4px 4px 0 0 var(--ink);padding:0;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.sw:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--ink)}
.sw:active,.sw.on{transform:translate(3px,3px);box-shadow:1px 1px 0 0 var(--ink)}
.sw.on::after{content:"";position:absolute;inset:-9px;border:3px solid var(--ink)}
.sw .lbl{position:absolute;left:0;right:0;bottom:-1.4rem;text-align:center;
  font-family:var(--font-mono);font-size:.625rem;letter-spacing:.08em;color:var(--muted)}
@media(prefers-reduced-motion:reduce){.sw{transition:none}}
`;

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
  css: CSS,
  options: () => OPTIONS,
  renderOption(opt) {
    const btn = document.createElement("button");
    btn.className = "sw";
    btn.style.background = String(opt.value);
    btn.title = opt.title;
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = opt.title;
    btn.append(lbl);
    return btn;
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
