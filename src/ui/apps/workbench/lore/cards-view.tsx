/**
 * Cards lens: dense entry tiles for quick glance (vs-lore-lenses).
 * Meta as pills; short clamp; click opens Pages. Mode chip cycles tri-mode.
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
  before_example: "Before ex",
  after_example: "After ex",
  depth: "Depth",
  append: "Append",
  append_bottom: "Append bot",
  prepend_top: "Prepend",
  scene: "Scene",
};

const cycleMode = (mode: EntryFireMode, vectorOk: boolean): EntryFireMode => {
  if (mode === "keyed") return "always";
  if (mode === "always") return vectorOk ? "meaning" : "keyed";
  return "keyed";
};

function metaPills(e: LorebookEntry): string[] {
  const pills: string[] = [];
  pills.push(POS_SHORT[e.position] ?? e.position);
  if (e.position === "depth" || e.position === "append") {
    pills.push(`@${e.depth}`);
  }
  if (e.probability < 100) pills.push(`${e.probability}%`);
  if (e.sticky > 0) pills.push(`sticky ${e.sticky}`);
  if (e.cooldown > 0) pills.push(`cool ${e.cooldown}`);
  if (e.delay > 0) pills.push(`delay ${e.delay}`);
  if (e.preventRecursion) pills.push("no wake-out");
  if (e.excludeRecursion) pills.push("no wake-in");
  if (e.delayUntilRecursion > 0) pills.push(`rec≥${e.delayUntilRecursion}`);
  if (e.ignoreBudget) pills.push("keep");
  if (e.groupName?.trim()) pills.push(`grp ${e.groupName.trim()}`);
  pills.push(`ord ${e.sortOrder}`);
  pills.push(`~${estimateEntryTokens(e)}t`);
  pills.push(e.enabled ? "on" : "off");
  return pills;
}

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
        const shown = keys.slice(0, 5);
        const extra = keys.length - shown.length;
        const pills = metaPills(e);
        const preview = (e.content || "").trim().replace(/\s+/g, " ");
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
            <p className={styles.clamp}>
              {preview || "No passage yet."}
            </p>
            <div className={styles.pills}>
              {shown.map((k) => (
                <span key={`k-${k}`} className={styles.kchip}>
                  {k}
                </span>
              ))}
              {extra > 0 && <span className={styles.kchip}>+{extra}</span>}
              {pills.map((p) => (
                <span key={p} className={styles.mpill}>
                  {p}
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
