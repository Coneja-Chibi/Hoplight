/**
 * Setup step: first deck ("What do you want to make first?"). Owns the stage's FLOOR zone: the
 * chosen deck stands up as a card; unanswered shows the dashed ghost slot. Copy verbatim from the
 * locked vs-setup-hybrid artifact. Writes SETTING_KEYS.firstDeck (a canonical kind).
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import type { SetupDraft, SetupOption, SetupStep } from "../../step-contract";

/** Option ids are canonical entity kinds - the same open kind strings the engine uses. */
const OPTIONS: SetupOption[] = [
  { id: "character", title: "Characters", sub: "The people you create.", isDefault: true },
  { id: "lorebook", title: "Lorebooks", sub: "The world facts they remember." },
  { id: "persona", title: "Personas", sub: "Who you are when you talk to them." },
  { id: "preset", title: "Presets", sub: "Saved settings that shape the writing." },
];

const CSS = `
.floor{background:var(--stage-floor);border-top:2px solid var(--accent);position:relative;
  padding:0 1rem 1rem;min-height:7rem}
.floor .fl-k{position:absolute;right:14px;top:-8px;background:var(--stage-floor);padding:0 6px;
  font-family:var(--font-mono);font-size:.47rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent)}
.troupe{display:flex;gap:.6rem;align-items:flex-end;justify-content:center;flex-wrap:wrap;
  margin-top:-3.6rem;position:relative;z-index:2;min-height:9.4rem}
.dcard{width:6.5rem;background:var(--stage-deck);border:3px solid #000;
  box-shadow:5px 6px 0 0 rgba(0,0,0,.55);position:relative}
.dcard .cov{aspect-ratio:3/4;background:#111015;border-bottom:3px solid #000;
  display:flex;align-items:flex-end;padding:7px;position:relative}
.dcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(2rem,2rem+1vw,2.75rem);
  line-height:.68;color:var(--stage-paper);opacity:.92}
.dcard .cov .ct{position:absolute;top:0;left:0;background:var(--accent);color:#fff;
  font-family:var(--font-mono);font-size:.44rem;font-weight:500;padding:2px 5px;
  letter-spacing:.06em;text-transform:uppercase;border-right:2px solid #000;border-bottom:2px solid #000}
.dcard .dn{font-family:var(--font-big);font-weight:700;font-size:.625rem;letter-spacing:.02em;
  text-transform:uppercase;color:var(--stage-paper);padding:6px 8px 7px}
.ghost-deck{width:6.5rem;aspect-ratio:3/4;border:2px dashed var(--stage-faint);
  display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;
  font-family:var(--font-mono);font-size:.53rem;letter-spacing:.06em;line-height:1.4;
  text-transform:uppercase;color:var(--stage-dim)}
`;

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** A deck card standing on the floor: big initial, kind tag, plural name. */
function deckCard(opt: SetupOption): HTMLElement {
  const card = h("div", "dcard");
  const cov = h("div", "cov");
  cov.append(h("b", undefined, opt.title.charAt(0)), h("span", "ct", opt.id));
  card.append(cov, h("div", "dn", opt.title));
  return card;
}

const step: SetupStep = {
  manifest: {
    id: "first-deck",
    order: 20,
    question: "What do you\nwant to make first?",
    say: "Just a starting point. Everything else is one click away later.",
    settingsKey: SETTING_KEYS.firstDeck,
    stageNote: "deck standing up",
  },
  css: CSS,
  options: () => OPTIONS,
  renderZone(draft: SetupDraft) {
    const floor = h("div", "floor");
    floor.append(h("span", "fl-k", "the floor"));
    const troupe = h("div", "troupe");
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.firstDeck]);
    troupe.append(picked ? deckCard(picked) : h("div", "ghost-deck", "your first deck stands here"));
    floor.append(troupe);
    return floor;
  },
  phrase(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.firstDeck]);
    return picked ? { pre: "starting with ", strong: picked.title } : null;
  },
  recap(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.firstDeck]);
    return picked ? { label: "first", value: picked.title.toLowerCase() } : null;
  },
};

export default step;
