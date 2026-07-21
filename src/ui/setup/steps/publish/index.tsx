/**
 * Setup step: publish targets ("Where do you publish?"). DATA-DRIVEN: the platform list derives
 * from the live format registry (unique friendly names), never a hardcoded roster - a drop-in
 * format automatically earns a plate here. Owns the stage's APRON zone (name-plates land as you
 * pick; "Not sure yet" keeps every slot ready). Multi-select; writes SETTING_KEYS.publishTargets.
 */
import type { JSX } from "react";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import type { SetupContext, SetupDraft, SetupOption, SetupStep } from "../../step-contract";

const NOT_SURE: SetupOption = {
  id: "none",
  title: "Not sure yet",
  sub: "Totally fine. We keep every format ready either way.",
  isDefault: true,
  clears: true,
};

const CSS = `
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

const picks = (draft: SetupDraft): string[] => {
  const v = draft[SETTING_KEYS.publishTargets];
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
};

const plainNote = (draft: SetupDraft): string => {
  if (draft[SETTING_KEYS.publishTargets] === undefined) return "Not set yet. Every format stays ready either way.";
  const n = picks(draft).length;
  if (n === 0) return "Not sure yet keeps every empty slot ready. No wrong answer.";
  return `${n} set. Every empty slot stays ready if you want it.`;
};

const step: SetupStep = {
  manifest: {
    id: "publish",
    order: 30,
    question: "Where do\nyou publish?",
    say: "Pick any that fit. We keep your work ready in each one.",
    settingsKey: SETTING_KEYS.publishTargets,
    multi: true,
    stageNote: "plates land as you pick",
  },
  css: CSS,
  async options(ctx: SetupContext) {
    const formats = await ctx.formats();
    const external = formats.filter((f) => !f.native); // our own storage format is not a platform
    const platforms = [...new Set(external.map((f) => f.friendly))].sort((a, b) => a.localeCompare(b));
    return [...platforms.map((p): SetupOption => ({ id: p, title: p })), NOT_SURE];
  },
  renderZone(draft: SetupDraft, options: SetupOption[]): JSX.Element {
    const landed = new Set(picks(draft));
    return (
      <div className="apron">
        <div className="apron-head">
          <span className="ap-k">Publish to</span>
        </div>
        <div className="plates">
          {options
            .filter((o) => !o.clears)
            .map((opt) => (
              <div key={opt.id} className={`plate${landed.has(opt.id) ? " landed" : ""}`}>
                <span className="pl-mk">{landed.has(opt.id) ? "landed" : "await"}</span>
                {opt.title}
              </div>
            ))}
        </div>
        <p className="ap-note">{plainNote(draft)}</p>
      </div>
    );
  },
  phrase(draft) {
    const chosen = picks(draft);
    return chosen.length ? { pre: "publishing to ", strong: chosen.join(" and ") } : null;
  },
  recap(draft) {
    const chosen = picks(draft);
    return { label: "publish", value: chosen.length ? chosen.join(", ").toLowerCase() : "not sure yet" };
  },
};

export default step;
