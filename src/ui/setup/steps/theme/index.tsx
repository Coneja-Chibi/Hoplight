/**
 * Setup step: theme ("Light or dark?"). Owns the two theme thumbnails and the stage's BACKWALL
 * zone (the tiny standing app preview that reskins by presence). Copy is verbatim from the locked
 * vs-setup-hybrid artifact. Writes SETTING_KEYS.theme ("paper" | "stage").
 */
import type { JSX } from "react";
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

function Bars({ cls, count }: { cls: string; count: number }): JSX.Element {
  return (
    <span className={cls}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}

/** The tiny standing app preview, skinned by the chosen theme (presence, not glow). */
function Preview({ dark }: { dark: boolean }): JSX.Element {
  return (
    <div className={`preview ${dark ? "dark" : "light"}`}>
      <div className="pv-top">
        <i />
        <i />
        <i />
      </div>
      <div className="pv-main">
        <div className="pv-side">
          <span className="lit" />
          <span />
          <span />
          <span />
        </div>
        <div className="pv-body">
          <span />
          <span />
          <span />
          <span className="btn" />
        </div>
      </div>
    </div>
  );
}

function ThemeOption(opt: SetupOption, pressed: boolean, onPick: () => void): JSX.Element {
  const dark = opt.id === "stage";
  return (
    <button className={`opt thumb${pressed ? " on" : ""}`} aria-pressed={pressed ? "true" : "false"} onClick={onPick}>
      {pressed && <span className="on-mark">Picked</span>}
      <span className={`mock ${dark ? "dark" : "light"}`}>
        <Bars cls="mbar" count={3} />
        <Bars cls="mbody" count={3} />
      </span>
      <span className="thumb-name">
        {opt.title}
        {opt.isDefault && <span className="default-tag">default</span>}
      </span>
    </button>
  );
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
  renderOption: ThemeOption,
  renderZone(draft: SetupDraft) {
    const dark = draft[SETTING_KEYS.theme] !== "paper"; // unanswered previews the dark default
    return (
      <div className="backwall">
        <div className="wall-note">your workspace, as you set it</div>
        <Preview dark={dark} />
        <div className="pv-cap">{dark ? "dark workspace" : "light workspace"}</div>
      </div>
    );
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
