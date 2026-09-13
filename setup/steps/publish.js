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

// src/ui/setup/steps/publish/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var NOT_SURE = {
  id: "none",
  title: "Not sure yet",
  sub: "Totally fine. We keep every format ready either way.",
  isDefault: true,
  clears: true
};
var CSS = `
.apron{border-top:3px dashed var(--stage-faint);background:var(--stage-well);padding:.75rem .95rem .9rem}
.apron-head{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:.55rem}
.apron-head .ap-k{font-family:var(--font-mono);font-weight:600;font-size:.625rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--stage-soft)}
.plates{display:flex;gap:.45rem;flex-wrap:wrap}
.plate{flex:1;min-width:4.5rem;height:2.75rem;border:2px dashed var(--stage-faint);background:transparent;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  font-family:var(--font-mono);font-weight:600;font-size:.625rem;letter-spacing:.04em;color:var(--stage-soft);
  text-transform:uppercase;text-align:center;line-height:1.2}
.plate .pl-mk{font-size:.6rem;font-weight:600;color:var(--stage-soft)}
.plate.landed{border:3px solid var(--accent);background:var(--stage-row);color:var(--stage-paper)}
.plate.landed .pl-mk{color:var(--accent);font-weight:500}
.ap-note{font-family:var(--font-mono);font-weight:600;font-size:.66rem;letter-spacing:.02em;
  color:var(--stage-soft);margin:.6rem 2px 0;line-height:1.5}
`;
var picks = (draft) => {
  const v = draft[SETTING_KEYS.publishTargets];
  return Array.isArray(v) ? v.filter((t) => typeof t === "string") : [];
};
var plainNote = (draft) => {
  if (draft[SETTING_KEYS.publishTargets] === undefined)
    return "Not set yet. Every format stays ready either way.";
  const n = picks(draft).length;
  if (n === 0)
    return "Not sure yet keeps every empty slot ready. No wrong answer.";
  return `${n} set. Every empty slot stays ready if you want it.`;
};
var step = {
  manifest: {
    id: "publish",
    order: 30,
    question: `Where do
you publish?`,
    say: "Pick any that fit. We keep your work ready in each one.",
    settingsKey: SETTING_KEYS.publishTargets,
    multi: true,
    stageNote: "plates land as you pick"
  },
  css: CSS,
  async options(ctx) {
    const formats = await ctx.formats();
    const external = formats.filter((f) => !f.native);
    const platforms = [...new Set(external.map((f) => f.friendly))].sort((a, b) => a.localeCompare(b));
    return [...platforms.map((p) => ({ id: p, title: p })), NOT_SURE];
  },
  renderZone(draft, options) {
    const landed = new Set(picks(draft));
    return /* @__PURE__ */ jsxDEV("div", {
      className: "apron",
      children: [
        /* @__PURE__ */ jsxDEV("div", {
          className: "apron-head",
          children: /* @__PURE__ */ jsxDEV("span", {
            className: "ap-k",
            children: "Publish to"
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV("div", {
          className: "plates",
          children: options.filter((o) => !o.clears).map((opt) => /* @__PURE__ */ jsxDEV("div", {
            className: `plate${landed.has(opt.id) ? " landed" : ""}`,
            children: [
              /* @__PURE__ */ jsxDEV("span", {
                className: "pl-mk",
                children: landed.has(opt.id) ? "landed" : "await"
              }, undefined, false, undefined, this),
              opt.title
            ]
          }, opt.id, true, undefined, this))
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV("p", {
          className: "ap-note",
          children: plainNote(draft)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  },
  phrase(draft) {
    const chosen = picks(draft);
    return chosen.length ? { pre: "publishing to ", strong: chosen.join(" and ") } : null;
  },
  recap(draft) {
    const chosen = picks(draft);
    return { label: "publish", value: chosen.length ? chosen.join(", ").toLowerCase() : "not sure yet" };
  }
};
var publish_default = step;
export {
  publish_default as default
};
