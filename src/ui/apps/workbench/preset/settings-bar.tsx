/**
 * SettingsBar - the collapsible Identity & Settings strip under the ehead (RC's
 * PresetSettingsSection / SamplerPanel, reduced to the surface that matters: description + the
 * samplers). RC's panel is 2400 lines of tabs; this is the same fields without the beast.
 *
 * Every sampler is OPTIONAL and absent-aware: a blank field means the preset does not carry that
 * value, and clearing one deletes the key rather than writing 0 (the Round-Trip Law - see
 * setSampler). So the inputs are text, not number: a number input hands back "" for junk and would
 * blur the difference between "cleared" and "zero".
 */
import { useState, type JSX } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PresetBody, PresetSamplers } from "../../../../entities/preset";
import type { AppContext } from "../../../app-contract";
import { ExpandTextarea } from "../../../components/expand";
import { LinkedSets } from "./linked-sets";
import s from "./settings.module.css";
import f from "./preset.module.css";

interface SamplerField {
  key: keyof PresetSamplers;
  label: string;
}

/** Labels + order transcribed from RC's SamplerPanel. */
const SAMPLERS: readonly SamplerField[] = [
  { key: "temperature", label: "Temperature" },
  { key: "topP", label: "Top P" },
  { key: "topK", label: "Top K" },
  { key: "topA", label: "Top A" },
  { key: "minP", label: "Min P" },
  { key: "frequencyPenalty", label: "Frequency Penalty" },
  { key: "presencePenalty", label: "Presence Penalty" },
  { key: "repetitionPenalty", label: "Repetition Penalty" },
  { key: "maxContext", label: "Max Context" },
  { key: "maxTokens", label: "Max Tokens" },
];

export interface SettingsBarProps {
  body: PresetBody;
  ctx: AppContext;
  /** false when the active Write-for lens cannot serialize samplers */
  showSamplers: boolean;
  onDescription: (v: string) => void;
  onSampler: (key: keyof PresetSamplers, value: number | undefined) => void;
  onBehaviorRefs: (ids: string[]) => void;
  onQuickReplyRefs: (ids: string[]) => void;
}

/** "" and junk both mean absent; a real 0 must survive. */
const parseSampler = (raw: string): number | undefined => {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

export function SettingsBar({
  body,
  ctx,
  showSamplers,
  onDescription,
  onSampler,
  onBehaviorRefs,
  onQuickReplyRefs,
}: SettingsBarProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const samplers = body.samplers ?? {};
  const setCount = SAMPLERS.filter((x) => samplers[x.key] !== undefined).length;

  return (
    <div className={s.bar}>
      <button type="button" className={s.head} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronUp size={14} className={s.chev} /> : <ChevronDown size={14} className={s.chev} />}
        <span className={s.title}>Identity &amp; Settings</span>
        <span className={s.summary}>
          {setCount === 0 ? "no samplers set" : `${setCount} sampler${setCount === 1 ? "" : "s"} set`}
        </span>
      </button>

      {open && (
        <div className={s.body}>
          <label className={f.sfield}>
            <span className={f.flabel}>Description</span>
            <ExpandTextarea
              label="Preset description"
              className={`${f.field} ${f.ta}`}
              value={body.description ?? ""}
              placeholder="What this preset is for"
              aria-label="Preset description"
              onChange={(e) => onDescription(e.target.value)}
            />
          </label>

          <LinkedSets
            ctx={ctx}
            behaviorRefs={body.behaviorRefs ?? []}
            quickReplyRefs={body.quickReplyRefs ?? []}
            onBehaviorRefs={onBehaviorRefs}
            onQuickReplyRefs={onQuickReplyRefs}
          />

          {showSamplers ? (
            <>
              <p className={s.note}>Blank means the preset does not set it, which is not the same as zero.</p>
              <div className={s.grid}>
                {SAMPLERS.map((x) => (
                  <label key={x.key} className={f.sfield}>
                    <span className={f.flabel}>{x.label}</span>
                    <input
                      className={f.field}
                      inputMode="decimal"
                      value={samplers[x.key] ?? ""}
                      placeholder="unset"
                      aria-label={x.label}
                      onChange={(e) => onSampler(x.key, parseSampler(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className={s.note}>This host does not carry sampler settings, so they stay hidden on this lens.</p>
          )}
        </div>
      )}
    </div>
  );
}
