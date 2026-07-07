/**
 * TrackerSetup - RoleCall's trackerPreset editor. Every immersion module toggles on/off; an enabled
 * one opens a no-code form (FieldForm / ListEditor) to seed its starting values, driven entirely by
 * the DATA in schemas.ts. A world theme and player notes sit alongside. Reuse-max: this component is
 * thin plumbing over the two schema primitives; adding or reshaping a module is a schema edit.
 *
 * Binds call-and-response to the whole trackerPreset object: { version, worldTheme?, notes?,
 * modules: {<id>: { enabled, ... }}, initialState: {<id>: <seed> } }.
 */
import type { JSX } from "react";
import { FieldForm } from "../field-form";
import { ListEditor } from "../list-editor";
import { ToggleSwitch } from "../toggle-switch";
import { TRACKER_MODULES, WORLD_THEMES, type TrackerModule } from "./schemas";
import styles from "./styles.module.css";

export interface TrackerSetupProps {
  value: Record<string, unknown>;
  onChange(next: Record<string, unknown>): void;
}

const asRec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function TrackerSetup({ value, onChange }: TrackerSetupProps): JSX.Element {
  const preset = asRec(value);
  const modules = asRec(preset.modules);
  const initial = asRec(preset.initialState);

  const patch = (p: Record<string, unknown>): void => onChange({ version: 1, ...preset, ...p });
  const setEnabled = (id: string, on: boolean): void =>
    patch({ modules: { ...modules, [id]: { ...asRec(modules[id]), enabled: on } } });
  const setSeed = (id: string, seedVal: unknown): void => patch({ initialState: { ...initial, [id]: seedVal } });

  const seedEditor = (m: TrackerModule): JSX.Element => {
    const s = m.seed;
    const title = (key?: string): ((it: Record<string, unknown>) => string) | undefined =>
      key ? (it) => str(it[key]) || "Item" : undefined;
    if (s.kind === "fields") {
      const obj = asRec(initial[m.id]);
      return <FieldForm fields={s.fields} value={obj} onChange={(k, v) => setSeed(m.id, { ...obj, [k]: v })} />;
    }
    if (s.kind === "list") {
      return (
        <ListEditor
          items={asArr(initial[m.id])}
          fields={s.itemFields}
          onChange={(next) => setSeed(m.id, next)}
          addLabel={s.addLabel}
          itemTitle={title(s.titleKey)}
        />
      );
    }
    const obj = asRec(initial[m.id]);
    return (
      <>
        {s.topFields ? <FieldForm fields={s.topFields} value={obj} onChange={(k, v) => setSeed(m.id, { ...obj, [k]: v })} /> : null}
        <ListEditor
          items={asArr(obj[s.listKey])}
          fields={s.itemFields}
          onChange={(next) => setSeed(m.id, { ...obj, [s.listKey]: next })}
          addLabel={s.addLabel}
          itemTitle={title(s.titleKey)}
        />
      </>
    );
  };

  return (
    <div className={styles.wrap}>
      <label className={styles.wt}>
        <span className={styles.k}>World theme</span>
        <select className={styles.sel} value={str(preset.worldTheme)} onChange={(e) => patch({ worldTheme: e.target.value })}>
          <option value="">(none)</option>
          {WORLD_THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {TRACKER_MODULES.map((m) => {
        const on = asRec(modules[m.id]).enabled === true;
        return (
          <div className={on ? `${styles.mod} ${styles.on}` : styles.mod} key={m.id}>
            <div className={styles.mhead}>
              <div className={styles.mtitle}>{m.label}</div>
              <ToggleSwitch on={on} onChange={(v) => setEnabled(m.id, v)} />
            </div>
            {on ? <div className={styles.mseed}>{seedEditor(m)}</div> : <div className={styles.mdesc}>{m.description}</div>}
          </div>
        );
      })}

      <label className={styles.notes}>
        <span className={styles.k}>Notes to the player</span>
        <textarea className={styles.ta} value={str(preset.notes)} onChange={(e) => patch({ notes: e.target.value })} />
      </label>
    </div>
  );
}
