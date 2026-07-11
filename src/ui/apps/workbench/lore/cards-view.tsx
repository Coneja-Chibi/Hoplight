/**
 * Cards lens: dense entry tiles for quick glance (vs-lore-lenses).
 * Meta as pills; no tall body. Click opens Pages. Mode chip cycles tri-mode.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch, type EntryFireMode } from "./entry-fire-mode";
import styles from "./cards-view.module.css";

export interface CardsViewProps {
  entries: readonly LorebookEntry[];
  writeFor: LoreWriteForProfile;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<LorebookEntry>) => void;
  onAdd: () => void;
}

const MODE_LABEL: Record<EntryFireMode, string> = {
  keyed: "Keys",
  always: "Always",
  meaning: "Meaning",
};

const POS_SHORT: Record<string, string> = {
  world: "World",
  character: "Char",
  before_example: "Bef.ex",
  after_example: "Aft.ex",
  depth: "Depth",
  append: "Append",
  append_bottom: "App.bot",
  prepend_top: "Prepend",
  scene: "Scene",
};

type PillTone = "meta" | "ok" | "warn" | "accent" | "mute";

interface MetaPill {
  key: string;
  label: string;
  tone: PillTone;
}

const cycleMode = (mode: EntryFireMode, vectorOk: boolean): EntryFireMode => {
  if (mode === "keyed") return "always";
  if (mode === "always") return vectorOk ? "meaning" : "keyed";
  return "keyed";
};

/** Glance meta only - always-on dials first, exceptions after. */
function metaPills(e: LorebookEntry): MetaPill[] {
  const pills: MetaPill[] = [];
  pills.push({
    key: "pos",
    label: POS_SHORT[e.position] ?? e.position,
    tone: "meta",
  });
  if (e.position === "depth" || e.position === "append") {
    pills.push({ key: "depth", label: `@${e.depth}`, tone: "meta" });
  }
  pills.push({
    key: "chance",
    label: `${e.probability}%`,
    tone: e.probability < 100 ? "accent" : "mute",
  });
  pills.push({ key: "ord", label: `ord ${e.sortOrder}`, tone: "mute" });
  if (e.priority !== 100) {
    pills.push({ key: "pri", label: `pri ${e.priority}`, tone: "meta" });
  }
  if (e.sticky > 0) pills.push({ key: "sticky", label: `sticky ${e.sticky}`, tone: "accent" });
  if (e.cooldown > 0) pills.push({ key: "cool", label: `cool ${e.cooldown}`, tone: "accent" });
  if (e.delay > 0) pills.push({ key: "delay", label: `delay ${e.delay}`, tone: "accent" });
  if (e.preventRecursion) pills.push({ key: "no-out", label: "no out", tone: "warn" });
  if (e.excludeRecursion) pills.push({ key: "no-in", label: "no in", tone: "warn" });
  if (e.delayUntilRecursion > 0) {
    pills.push({ key: "rec", label: `rec≥${e.delayUntilRecursion}`, tone: "accent" });
  }
  if (e.ignoreBudget) pills.push({ key: "keep", label: "keep", tone: "warn" });
  if (e.useMemo) pills.push({ key: "memo", label: "memo", tone: "meta" });
  if (e.vectorized) pills.push({ key: "vec", label: "vec", tone: "meta" });
  if (e.groupName?.trim()) {
    pills.push({ key: "grp", label: `grp ${e.groupName.trim()}`, tone: "meta" });
  }
  pills.push({
    key: "tok",
    label: `~${estimateEntryTokens(e)}t`,
    tone: "mute",
  });
  pills.push({
    key: "on",
    label: e.enabled ? "on" : "off",
    tone: e.enabled ? "ok" : "warn",
  });
  return pills;
}

const pillClass = (tone: PillTone): string => {
  const base = styles.mpill ?? "mpill";
  if (tone === "ok") return `${base} ${styles.mpillOk ?? ""}`.trim();
  if (tone === "warn") return `${base} ${styles.mpillWarn ?? ""}`.trim();
  if (tone === "accent") return `${base} ${styles.mpillAccent ?? ""}`.trim();
  if (tone === "mute") return `${base} ${styles.mpillMute ?? ""}`.trim();
  return base;
};

export function CardsView({
  entries,
  writeFor,
  onSelect,
  onPatch,
  onAdd,
}: CardsViewProps): JSX.Element {
  const vectorOk = fieldVisible(writeFor, "vectorized");

  return (
    <div className={styles.grid} aria-label="Entry cards">
      {entries.map((e) => {
        const mode = entryFireMode(e);
        const keys = e.triggers.map((t) => t.keyword).filter(Boolean);
        const shown = keys.slice(0, 4);
        const extra = keys.length - shown.length;
        const pills = metaPills(e);
        return (
          <div
            key={e.id}
            role="button"
            tabIndex={0}
            className={e.enabled ? styles.ecard : `${styles.ecard} ${styles.ecardOff}`}
            onClick={() => onSelect(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect(e.id);
              }
            }}
          >
            <div className={styles.ehead}>
              <b className={styles.etitle}>{e.title || "(untitled)"}</b>
              <button
                type="button"
                className={styles.modeChip}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onPatch(e.id, fireModePatch(cycleMode(mode, vectorOk)));
                }}
              >
                {MODE_LABEL[mode]}
              </button>
            </div>
            <div className={styles.keys}>
              {shown.length === 0 ? (
                <span className={styles.kEmpty}>no keys</span>
              ) : (
                <>
                  {shown.map((k) => (
                    <span key={`k-${k}`} className={styles.kchip}>
                      {k}
                    </span>
                  ))}
                  {extra > 0 && <span className={styles.kchip}>+{extra}</span>}
                </>
              )}
            </div>
            <div className={styles.pills}>
              {pills.map((p) => (
                <span key={p.key} className={pillClass(p.tone)}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <button type="button" className={styles.ghost} onClick={onAdd}>
        + New entry
      </button>
    </div>
  );
}
