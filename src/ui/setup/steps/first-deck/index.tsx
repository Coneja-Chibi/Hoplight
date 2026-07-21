/**
 * Setup step: what you make ("What do you want to make?"). MULTI-select: every picked deck stands
 * up on the stage floor as a fanned arc of cards; the FIRST pick is where the Library opens
 * (derived into SETTING_KEYS.firstDeck at completion). Unanswered shows the dashed ghost slot.
 * Writes SETTING_KEYS.makes (canonical kinds, pick order preserved).
 */
import type { CSSProperties, JSX } from "react";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import type { SetupDraft, SetupOption, SetupStep } from "../../step-contract";

/** Option ids are canonical entity kinds - the same open kind strings the engine uses. */
const OPTIONS: SetupOption[] = [
  { id: "character", title: "Characters", sub: "The people you create.", isDefault: true },
  { id: "lorebook", title: "Lorebooks", sub: "The world facts they remember." },
  { id: "persona", title: "Personas", sub: "Who you are when you talk to them." },
  { id: "pack", title: "Sprite packs", sub: "Reusable face packs you open like folders." },
  { id: "preset", title: "Presets", sub: "Saved settings that shape the writing." },
];

const CSS = `
.floor{background:var(--stage-floor);border-top:2px solid var(--accent);position:relative;
  padding:0 1rem 1rem;min-height:7rem}
.floor .fl-k{position:absolute;right:14px;top:-8px;background:var(--stage-floor);padding:0 6px;
  font-family:var(--font-mono);font-size:.47rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent)}
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
  font-family:var(--font-mono);font-size:.44rem;font-weight:500;padding:2px 5px;
  letter-spacing:.06em;text-transform:uppercase;border-right:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
.dcard .cov .first-mk{position:absolute;bottom:6px;right:6px;background:var(--accent);
  color:var(--stage-white);font-family:var(--font-mono);font-size:.42rem;font-weight:600;
  letter-spacing:.08em;text-transform:uppercase;padding:2px 5px}
.dcard .dn{font-family:var(--font-big);font-weight:700;font-size:.625rem;letter-spacing:.02em;
  text-transform:uppercase;color:var(--stage-paper);padding:6px 8px 7px}
.ghost-deck{width:6.5rem;aspect-ratio:3/4;border:2px dashed var(--stage-faint);
  display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;
  font-family:var(--font-mono);font-size:.53rem;letter-spacing:.06em;line-height:1.4;
  text-transform:uppercase;color:var(--stage-dim)}
`;

const picks = (draft: SetupDraft): string[] => {
  const v = draft[SETTING_KEYS.makes];
  return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
};

/** A deck card standing on the floor: big initial, kind tag, plural name, FIRST mark on pick #1. */
function DeckCard({ opt, first }: { opt: SetupOption; first: boolean }): JSX.Element {
  return (
    <div className="dcard">
      <div className="cov">
        <b>{opt.title.charAt(0)}</b>
        <span className="ct">{opt.id}</span>
        {first && <span className="first-mk">opens first</span>}
      </div>
      <div className="dn">{opt.title}</div>
    </div>
  );
}

/** The fan: cards arc across the floor, rotation and lift spread from the center outward. */
function fanVars(i: number, n: number): CSSProperties {
  const mid = (n - 1) / 2;
  const spread = n > 1 ? Math.min(24 / (n - 1), 10) : 0;
  const rot = (i - mid) * spread;
  const lift = Math.abs(i - mid) * (n > 3 ? 7 : 5);
  return { "--rot": `${rot}deg`, "--lift": `${lift}px` } as CSSProperties;
}

const step: SetupStep = {
  manifest: {
    id: "first-deck",
    order: 20,
    question: "What do you\nwant to make?",
    say: "Pick as many as you like. The first pick is where the Library opens.",
    settingsKey: SETTING_KEYS.makes,
    multi: true,
    stageNote: "decks standing up",
  },
  css: CSS,
  options: () => OPTIONS,
  renderZone(draft: SetupDraft) {
    const chosen = picks(draft)
      .map((k) => OPTIONS.find((o) => o.id === k))
      .filter((o): o is SetupOption => !!o);
    return (
      <div className="floor">
        <span className="fl-k">the floor</span>
        <div className="troupe">
          {chosen.length === 0 ? (
            <div className="ghost-deck">your decks stand here</div>
          ) : (
            chosen.map((opt, i) => (
              <div key={opt.id} className="fan-slot" style={fanVars(i, chosen.length)}>
                <DeckCard opt={opt} first={i === 0} />
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
  // the Library opens on the FIRST pick; an empty pick set falls back to characters
  deriveSettings(draft: SetupDraft) {
    return { [SETTING_KEYS.firstDeck]: picks(draft)[0] ?? "character" };
  },
  phrase(draft) {
    const chosen = picks(draft);
    const first = OPTIONS.find((o) => o.id === chosen[0]);
    if (!first) return null;
    const more = chosen.length - 1;
    return { pre: "making ", strong: first.title, post: more > 0 ? ` (+${more} more)` : "" };
  },
  recap(draft) {
    const chosen = picks(draft)
      .map((k) => OPTIONS.find((o) => o.id === k)?.title.toLowerCase())
      .filter((t): t is string => !!t);
    return chosen.length > 0 ? { label: "making", value: chosen.join(" · ") } : null;
  },
};

export default step;
