// src/studio/settings-shape.ts
var SETTING_KEYS = {
  theme: "theme",
  firstDeck: "firstDeck",
  makes: "makes",
  publishTargets: "publishTargets",
  houseAccent: "houseAccent",
  homeApp: "homeApp",
  workbenchFollow: "workbench.follow",
  workbenchRecents: "workbench.recents",
  dockSlim: "shell.dockSlim",
  remoteAccessEnabled: "remoteAccessEnabled"
};

// src/ui/setup/steps/theme/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var OPTIONS = [
  { id: "paper", title: "Light" },
  { id: "stage", title: "Dark", isDefault: true }
];
var CSS = `
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
.mock.light{color:var(--stage-well);background:var(--paper)} /* hardcode-ok: literal theme-preview swatch, depicts both themes at once so it cannot flip */
.mock.dark{color:var(--stage-paper);background:var(--stage-row)} /* hardcode-ok: literal theme-preview swatch */
.thumb-name{font-family:var(--font-big);font-weight:600;font-size:1rem}
.backwall{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:1rem;padding:1.75rem 1.5rem 1.25rem;text-align:center}
.wall-note{font-family:var(--font-mono);font-weight:600;font-size:.625rem;letter-spacing:.2em;
  text-transform:uppercase;color:var(--status-fg)} /* the wizard wall is var(--stage): dark in BOTH themes, so
  the ink must be the bright-on-dark pair (stage-soft flips dark in light mode and vanished) */
.preview{width:min(12.25rem,90%);border:3px solid var(--pv-line);background:var(--pv-bg);
  box-shadow:5px 6px 0 0 var(--shadow-ink)}
.preview.dark{--pv-bg:var(--stage-row);--pv-line:var(--stage-black);--pv-top:var(--stage-sunken);--pv-dim:#3a3646;--pv-lit:#6f6a7d} /* hardcode-ok: literal theme-preview swatches */
.preview.light{--pv-bg:var(--paper);--pv-line:var(--stage-well);--pv-top:#efeadd;--pv-dim:#cec6b2;--pv-lit:#8a8272} /* hardcode-ok: literal theme-preview swatches */
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
.pv-cap{font-family:var(--font-mono);font-weight:600;font-size:.625rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--status-fg)} /* bright-on-dark pair; see .wall-note */
`;
function Bars({ cls, count }) {
  return /* @__PURE__ */ jsxDEV("span", {
    className: cls,
    children: Array.from({ length: count }, (_, i) => /* @__PURE__ */ jsxDEV("span", {}, i, false, undefined, this))
  }, undefined, false, undefined, this);
}
function Preview({ dark }) {
  return /* @__PURE__ */ jsxDEV("div", {
    className: `preview ${dark ? "dark" : "light"}`,
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        className: "pv-top",
        children: [
          /* @__PURE__ */ jsxDEV("i", {}, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("i", {}, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("i", {}, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: "pv-main",
        children: [
          /* @__PURE__ */ jsxDEV("div", {
            className: "pv-side",
            children: [
              /* @__PURE__ */ jsxDEV("span", {
                className: "lit"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("span", {}, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("span", {}, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("span", {}, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV("div", {
            className: "pv-body",
            children: [
              /* @__PURE__ */ jsxDEV("span", {}, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("span", {}, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("span", {}, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("span", {
                className: "btn"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function ThemeOption(opt, pressed, onPick) {
  const dark = opt.id === "stage";
  return /* @__PURE__ */ jsxDEV("button", {
    className: `opt thumb${pressed ? " on" : ""}`,
    "aria-pressed": pressed ? "true" : "false",
    onClick: onPick,
    children: [
      pressed && /* @__PURE__ */ jsxDEV("span", {
        className: "on-mark",
        children: "Picked"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("span", {
        className: `mock ${dark ? "dark" : "light"}`,
        children: [
          /* @__PURE__ */ jsxDEV(Bars, {
            cls: "mbar",
            count: 3
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV(Bars, {
            cls: "mbody",
            count: 3
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("span", {
        className: "thumb-name",
        children: [
          opt.title,
          opt.isDefault && /* @__PURE__ */ jsxDEV("span", {
            className: "default-tag",
            children: "default"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var step = {
  manifest: {
    id: "theme",
    order: 10,
    question: "Light or dark?",
    say: "However you like your workspace. You can flip it any time.",
    settingsKey: SETTING_KEYS.theme,
    layoutClass: "pair",
    stageNote: "it lights as you answer"
  },
  css: CSS,
  options: () => OPTIONS,
  renderOption: ThemeOption,
  pageTheme(draft) {
    const v = draft[SETTING_KEYS.theme];
    return v === "paper" || v === "stage" ? v : undefined;
  },
  renderZone(draft) {
    const dark = draft[SETTING_KEYS.theme] !== "paper";
    return /* @__PURE__ */ jsxDEV("div", {
      className: "backwall",
      children: [
        /* @__PURE__ */ jsxDEV("div", {
          className: "wall-note",
          children: "your workspace, as you set it"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV(Preview, {
          dark
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV("div", {
          className: "pv-cap",
          children: dark ? "dark workspace" : "light workspace"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  },
  phrase(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.theme]);
    return picked ? { pre: "a ", strong: picked.title.toLowerCase(), post: " workspace" } : null;
  },
  recap(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.theme]);
    return picked ? { label: "theme", value: picked.title.toLowerCase() } : null;
  }
};
var theme_default = step;
export {
  theme_default as default
};
