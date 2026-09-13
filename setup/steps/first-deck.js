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

// src/ui/setup/steps/first-deck/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var OPTIONS = [
  { id: "character", title: "Characters", sub: "The people you create.", isDefault: true },
  { id: "lorebook", title: "Lorebooks", sub: "The world facts they remember." },
  { id: "persona", title: "Personas", sub: "Who you are when you talk to them." },
  { id: "pack", title: "Sprite packs", sub: "Reusable face packs you open like folders." },
  { id: "preset", title: "Presets", sub: "Saved settings that shape the writing." }
];
var CSS = `
.floor{background:var(--stage-floor);border-top:2px solid var(--accent);position:relative;
  padding:0 1rem 1rem;min-height:7rem}
.floor .fl-k{position:absolute;right:14px;top:-8px;background:var(--stage-floor);padding:0 6px;
  font-family:var(--font-mono);font-weight:600;font-size:.625rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--stage-soft)}
.troupe{display:flex;gap:.35rem;align-items:flex-end;justify-content:center;
  margin-top:-3.6rem;position:relative;z-index:2;min-height:9.8rem;padding-top:.8rem}
.fan-slot{transform:rotate(var(--rot)) translateY(var(--lift));transform-origin:50% 100%;
  transition:transform .18s ease-out}
.dcard{width:6.5rem;background:var(--stage-deck);border:3px solid var(--stage-black);
  box-shadow:5px 6px 0 0 var(--shadow-ink);position:relative}
.dcard .cov{aspect-ratio:3/4;background:var(--stage-row);border-bottom:3px solid var(--stage-black);
  display:flex;align-items:flex-end;padding:7px;position:relative}
.dcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(2rem,2rem+1vw,2.75rem);
  line-height:.68;color:var(--stage-paper);opacity:.92}
.dcard .cov .ct{position:absolute;top:0;left:0;background:var(--accent);color:var(--stage-white);
  font-family:var(--font-mono);font-size:.625rem;font-weight:600;padding:2px 5px;
  letter-spacing:.06em;text-transform:uppercase;border-right:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
.dcard .cov .first-mk{position:absolute;bottom:6px;right:6px;background:var(--accent);
  color:var(--stage-white);font-family:var(--font-mono);font-size:.6rem;font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;padding:2px 5px}
.dcard .dn{font-family:var(--font-big);font-weight:700;font-size:.625rem;letter-spacing:.02em;
  text-transform:uppercase;color:var(--stage-paper);padding:6px 8px 7px}
.ghost-deck{width:6.5rem;aspect-ratio:3/4;border:2px dashed var(--stage-faint);
  display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;
  font-family:var(--font-mono);font-weight:600;font-size:.625rem;letter-spacing:.05em;line-height:1.45;
  text-transform:uppercase;color:var(--stage-soft)}
`;
var picks = (draft) => {
  const v = draft[SETTING_KEYS.makes];
  return Array.isArray(v) ? v.filter((k) => typeof k === "string") : [];
};
function DeckCard({ opt, first }) {
  return /* @__PURE__ */ jsxDEV("div", {
    className: "dcard",
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        className: "cov",
        children: [
          /* @__PURE__ */ jsxDEV("b", {
            children: opt.title.charAt(0)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("span", {
            className: "ct",
            children: opt.id
          }, undefined, false, undefined, this),
          first && /* @__PURE__ */ jsxDEV("span", {
            className: "first-mk",
            children: "opens first"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: "dn",
        children: opt.title
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function fanVars(i, n) {
  const mid = (n - 1) / 2;
  const spread = n > 1 ? Math.min(24 / (n - 1), 10) : 0;
  const rot = (i - mid) * spread;
  const lift = Math.abs(i - mid) * (n > 3 ? 7 : 5);
  return { "--rot": `${rot}deg`, "--lift": `${lift}px` };
}
var step = {
  manifest: {
    id: "first-deck",
    order: 20,
    question: `What do you
want to make?`,
    say: "Pick as many as you like. The first pick is where the Library opens.",
    settingsKey: SETTING_KEYS.makes,
    multi: true,
    stageNote: "decks standing up"
  },
  css: CSS,
  options: () => OPTIONS,
  renderZone(draft) {
    const chosen = picks(draft).map((k) => OPTIONS.find((o) => o.id === k)).filter((o) => !!o);
    return /* @__PURE__ */ jsxDEV("div", {
      className: "floor",
      children: [
        /* @__PURE__ */ jsxDEV("span", {
          className: "fl-k",
          children: "the floor"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV("div", {
          className: "troupe",
          children: chosen.length === 0 ? /* @__PURE__ */ jsxDEV("div", {
            className: "ghost-deck",
            children: "your decks stand here"
          }, undefined, false, undefined, this) : chosen.map((opt, i) => /* @__PURE__ */ jsxDEV("div", {
            className: "fan-slot",
            style: fanVars(i, chosen.length),
            children: /* @__PURE__ */ jsxDEV(DeckCard, {
              opt,
              first: i === 0
            }, undefined, false, undefined, this)
          }, opt.id, false, undefined, this))
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  },
  deriveSettings(draft) {
    return { [SETTING_KEYS.firstDeck]: picks(draft)[0] ?? "character" };
  },
  phrase(draft) {
    const chosen = picks(draft);
    const first = OPTIONS.find((o) => o.id === chosen[0]);
    if (!first)
      return null;
    const more = chosen.length - 1;
    return { pre: "making ", strong: first.title, post: more > 0 ? ` (+${more} more)` : "" };
  },
  recap(draft) {
    const chosen = picks(draft).map((k) => OPTIONS.find((o) => o.id === k)?.title.toLowerCase()).filter((t) => !!t);
    return chosen.length > 0 ? { label: "making", value: chosen.join(" · ") } : null;
  }
};
var first_deck_default = step;
export {
  first_deck_default as default
};
