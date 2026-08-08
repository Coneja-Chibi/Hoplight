/**
 * RawExtensions - the crumb net. Lists every key in a platform's extension bag that DOESN'T already
 * have a dedicated component above, and makes each editable, so an unknown key (even one nobody has
 * invented) is never frozen and never lost. A primitive gets a proper control (text / number /
 * toggle); a structured value gets a tolerant JSON editor (it keeps your typing even mid-edit and
 * only commits when the JSON is valid). Not a lazy dump: the right tool for genuinely open data.
 */
import { useState } from "react";
import type { JSX } from "react";
import { ExpandTextarea } from "../expand";
import { ToggleSwitch } from "../toggle-switch";
import styles from "./styles.module.css";

export interface RawExtensionsProps {
  /** the extension object (already resolved from the original) */
  data: Record<string, unknown>;
  /** keys that have a dedicated component elsewhere and should be hidden here */
  handled: readonly string[];
  /** write a single key back */
  onChange(key: string, value: unknown): void;
}

/** A structured value edited as tolerant JSON: local text survives invalid states; commit on valid. */
function JsonField({ label, value, onCommit }: { label: string; value: unknown; onCommit(v: unknown): void }): JSX.Element {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <div>
      <ExpandTextarea
        label={label}
        className={styles.json}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            onCommit(JSON.parse(next));
            setBad(false);
          } catch {
            setBad(true); // keep the text, do not lose the edit; just don't commit invalid JSON
          }
        }}
      />
      {bad ? <div className={styles.bad}>invalid JSON - not saved until it parses</div> : null}
    </div>
  );
}

function valueControl(key: string, value: unknown, onChange: (v: unknown) => void): JSX.Element {
  if (typeof value === "boolean") return <ToggleSwitch on={value} onChange={onChange} label={value ? "On" : "Off"} />;
  if (typeof value === "number") {
    return (
      <input
        className={styles.num}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    );
  }
  if (typeof value === "string") {
    return <input className={styles.text} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return <JsonField label={key} value={value} onCommit={onChange} />;
}

export function RawExtensions({ data, handled, onChange }: RawExtensionsProps): JSX.Element | null {
  const keys = Object.keys(data).filter((k) => !handled.includes(k));
  if (keys.length === 0) return null; // nothing unhandled -> the card omits the catch-all entirely
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>Anything else in the extension slot</div>
      {keys.map((k) => (
        <div className={styles.row} key={k}>
          <div className={styles.key}>{k}</div>
          {valueControl(k, data[k], (v) => onChange(k, v))}
        </div>
      ))}
    </div>
  );
}
