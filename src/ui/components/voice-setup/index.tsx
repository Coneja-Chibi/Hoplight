/**
 * VoiceSetup - canonical Voice editor (approved vs-agnai-components look).
 * Binds body.persona.voice; format adapters map to Agnai service/voiceDisabled on export.
 */
import type { JSX } from "react";
import { Slider } from "../slider";
import { ToggleSwitch } from "../toggle-switch";
import { VOICE_SERVICES, normalizeVoice, voiceToCanonical, type VoiceValue } from "./core";
import styles from "./styles.module.css";

export interface VoiceSetupProps {
  value: unknown;
  onChange(voice: Record<string, unknown>): void;
}

export function VoiceSetup({ value, onChange }: VoiceSetupProps): JSX.Element {
  const v = normalizeVoice(value);
  const commit = (next: VoiceValue): void => onChange(voiceToCanonical(next));

  const extras = Object.entries(v.extras);

  return (
    <div className={styles.wrap}>
      <ToggleSwitch
        on={v.disabled}
        onChange={(disabled) => commit({ ...v, disabled })}
        label={v.disabled ? "Voice disabled (config kept)" : "Voice enabled"}
      />
      <div className={styles.grid}>
        <div>
          <span className={styles.lbl}>Provider</span>
          <select
            className={styles.sel}
            value={v.provider}
            onChange={(e) => commit({ ...v, provider: e.target.value })}
          >
            {!VOICE_SERVICES.includes(v.provider as (typeof VOICE_SERVICES)[number]) && (
              <option value={v.provider}>{v.provider}</option>
            )}
            {VOICE_SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <span className={styles.lbl}>Voice id</span>
          <input
            className={styles.input}
            value={v.voiceId}
            onChange={(e) => commit({ ...v, voiceId: e.target.value })}
            placeholder="voice id"
          />
        </div>
      </div>
      <div>
        <span className={styles.lbl}>Rate</span>
        <Slider
          value={v.rate}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(rate) => commit({ ...v, rate })}
          format={(n) => n.toFixed(2)}
          aria-label="Speech rate"
        />
      </div>
      <div>
        <span className={styles.lbl}>Pitch</span>
        <Slider
          value={v.pitch}
          min={-1}
          max={1}
          step={0.05}
          onChange={(pitch) => commit({ ...v, pitch })}
          format={(n) => n.toFixed(2)}
          aria-label="Speech pitch"
        />
      </div>
      <span className={styles.lbl}>Extras</span>
      <div className={styles.extras}>
        {extras.map(([k, val]) => (
          <div className={styles.exrow} key={k}>
            <input
              className={styles.input}
              value={k}
              onChange={(e) => {
                const next = { ...v.extras };
                delete next[k];
                next[e.target.value || k] = val;
                commit({ ...v, extras: next });
              }}
            />
            <input
              className={styles.input}
              value={val}
              onChange={(e) => commit({ ...v, extras: { ...v.extras, [k]: e.target.value } })}
            />
            <button
              type="button"
              className={styles.rm}
              onClick={() => {
                const next = { ...v.extras };
                delete next[k];
                commit({ ...v, extras: next });
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.add}
          onClick={() => {
            let i = 1;
            let key = "extra";
            while (Object.hasOwn(v.extras, key)) {
              i += 1;
              key = `extra_${i}`;
            }
            commit({ ...v, extras: { ...v.extras, [key]: "" } });
          }}
        >
          + extra
        </button>
      </div>
    </div>
  );
}
