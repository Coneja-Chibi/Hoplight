/**
 * Setup step: theme ("Light or dark?"). Owns the two theme thumbnails and the stage's BACKWALL
 * zone (the tiny standing app preview that reskins by presence). Copy is verbatim from the locked
 * vs-setup-hybrid artifact. Writes SETTING_KEYS.theme ("paper" | "stage").
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import type { SetupDraft, SetupOption, SetupStep } from "../../step-contract";

const OPTIONS: SetupOption[] = [
  { id: "paper", title: "Light" },
  { id: "stage", title: "Dark", isDefault: true },
];

const CSS = `
.pair{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
@media(max-width:32.5rem){.pair{grid-template-columns:1fr}}
.thumb{display:flex;flex-direction:column;gap:.7rem;align-items:center;padding-top:.95rem}
.mock{width:100%;aspect-ratio:4/3;border:2px solid currentColor;display:flex;overflow:hidden}
.mock .mbar{width:26%;border-right:2px solid currentColor;display:flex;flex-direction:column;gap:6px;padding:7px 6px}
.mock .mbar span{height:6px;background:currentColor;opacity:.55;display:block}
.mock .mbar span:first-child{opacity:1;width:70%}
.mock .mbody{flex:1;padding:8px;display:flex;flex-direction:column;gap:6px}
.mock .mbody span{height:6px;background:currentColor;opacity:.4;display:block}
.mock .mbody span:nth-child(1){width:60%;opacity:.75}
.mock .mbody span:nth-child(2){width:90%}
.mock .mbody span:nth-child(3){width:80%}
.mock.light{color:#0a0a0b;background:#faf8f3}
.mock.dark{color:#e7e3da;background:#141019}
.thumb-name{font-family:var(--font-big);font-weight:600;font-size:1rem}
.backwall{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:1rem;padding:1.75rem 1.5rem 1.25rem;text-align:center}
.wall-note{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.24em;
  text-transform:uppercase;color:var(--stage-faint)}
.preview{width:min(12.25rem,90%);border:3px solid var(--pv-line);background:var(--pv-bg);
  box-shadow:5px 6px 0 0 rgba(0,0,0,.5)}
.preview.dark{--pv-bg:#141019;--pv-line:#000;--pv-top:#0d0c11;--pv-dim:#3a3646;--pv-lit:#6f6a7d}
.preview.light{--pv-bg:#faf8f3;--pv-line:#0a0a0b;--pv-top:#efeadd;--pv-dim:#cec6b2;--pv-lit:#8a8272}
.pv-top{height:16px;background:var(--pv-top);border-bottom:2px solid var(--pv-line);
  display:flex;align-items:center;gap:4px;padding:0 6px}
.pv-top i{width:6px;height:6px;background:var(--pv-dim);display:block}
.pv-main{display:flex;min-height:6.5rem}
.pv-side{width:34%;border-right:2px solid var(--pv-line);padding:8px 6px;
  display:flex;flex-direction:column;gap:6px}
.pv-side span{height:5px;background:var(--pv-dim);display:block}
.pv-side .lit{width:82%;background:var(--accent)}
.pv-body{flex:1;padding:9px 8px;display:flex;flex-direction:column;gap:6px}
.pv-body span{height:6px;background:var(--pv-dim);display:block}
.pv-body span:nth-child(1){width:64%;background:var(--pv-lit)}
.pv-body span:nth-child(2){width:92%}
.pv-body span:nth-child(3){width:78%}
.pv-body .btn{height:12px;width:44%;margin-top:3px;background:var(--accent)}
.pv-cap{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--stage-dim)}
`;

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const bars = (cls: string, count: number): HTMLElement => {
  const wrap = h("span", cls);
  for (let i = 0; i < count; i++) wrap.append(h("span"));
  return wrap;
};

/** The tiny standing app preview, skinned by the chosen theme (presence, not glow). */
function preview(dark: boolean): HTMLElement {
  const pv = h("div", `preview ${dark ? "dark" : "light"}`);
  const top = h("div", "pv-top");
  for (let i = 0; i < 3; i++) top.append(h("i"));
  const side = bars("pv-side", 3);
  side.prepend(Object.assign(h("span"), { className: "lit" }));
  const body = bars("pv-body", 3);
  body.append(h("span", "btn"));
  const main = h("div", "pv-main");
  main.append(side, body);
  pv.append(top, main);
  return pv;
}

const step: SetupStep = {
  manifest: {
    id: "theme",
    order: 10,
    question: "Light or dark?",
    say: "However you like your workspace. You can flip it any time.",
    settingsKey: SETTING_KEYS.theme,
    layoutClass: "pair",
    stageNote: "it lights as you answer",
  },
  css: CSS,
  options: () => OPTIONS,
  renderOption(opt) {
    const btn = h("button", "opt thumb");
    const mock = h("span", `mock ${opt.id === "stage" ? "dark" : "light"}`);
    mock.append(bars("mbar", 3), bars("mbody", 3));
    const name = h("span", "thumb-name", opt.title);
    if (opt.isDefault) name.append(Object.assign(h("span", "default-tag"), { textContent: "default" }));
    btn.append(mock, name);
    return btn;
  },
  renderZone(draft: SetupDraft) {
    const dark = draft[SETTING_KEYS.theme] !== "paper"; // unanswered previews the dark default
    const wall = h("div", "backwall");
    wall.append(
      h("div", "wall-note", "your workspace, as you set it"),
      preview(dark),
      h("div", "pv-cap", dark ? "dark workspace" : "light workspace"),
    );
    return wall;
  },
  phrase(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.theme]);
    return picked ? { pre: "a ", strong: picked.title.toLowerCase(), post: " workspace" } : null;
  },
  recap(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.theme]);
    return picked ? { label: "theme", value: picked.title.toLowerCase() } : null;
  },
};

export default step;
