/**
 * Setup step: first deck ("What do you want to make first?"). Owns the stage's FLOOR zone: the
 * chosen deck stands up as a card; unanswered shows the dashed ghost slot. Copy verbatim from the
 * locked vs-setup-hybrid artifact. Writes SETTING_KEYS.firstDeck (a canonical kind).
 */
import type { JSX } from "react";
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
.dcard{width:6.5rem;background:var(--stage-deck);border:3px solid var(--stage-black);
  box-shadow:5px 6px 0 0 rgba(0,0,0,.55);position:relative}
.dcard .cov{aspect-ratio:3/4;background:var(--stage-row);border-bottom:3px solid var(--stage-black);
  display:flex;align-items:flex-end;padding:7px;position:relative}
.dcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(2rem,2rem+1vw,2.75rem);
  line-height:.68;color:var(--stage-paper);opacity:.92}
.dcard .cov .ct{position:absolute;top:0;left:0;background:var(--accent);color:var(--stage-white);
  font-family:var(--font-mono);font-size:.44rem;font-weight:500;padding:2px 5px;
  letter-spacing:.06em;text-transform:uppercase;border-right:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
.dcard .dn{font-family:var(--font-big);font-weight:700;font-size:.625rem;letter-spacing:.02em;
  text-transform:uppercase;color:var(--stage-paper);padding:6px 8px 7px}
.ghost-deck{width:6.5rem;aspect-ratio:3/4;border:2px dashed var(--stage-faint);
  display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;
  font-family:var(--font-mono);font-size:.53rem;letter-spacing:.06em;line-height:1.4;
  text-transform:uppercase;color:var(--stage-dim)}
`;

/** A deck card standing on the floor: big initial, kind tag, plural name. */
function DeckCard({ opt }: { opt: SetupOption }): JSX.Element {
  return (
    <div className="dcard">
      <div className="cov">
        <b>{opt.title.charAt(0)}</b>
        <span className="ct">{opt.id}</span>
      </div>
      <div className="dn">{opt.title}</div>
    </div>
  );
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
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.firstDeck]);
    return (
      <div className="floor">
        <span className="fl-k">the floor</span>
        <div className="troupe">
          {picked ? <DeckCard opt={picked} /> : <div className="ghost-deck">your first deck stands here</div>}
        </div>
      </div>
    );
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
