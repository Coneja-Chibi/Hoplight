/**
 * LoreSpecialTriggers - RC-style "+ Condition" menu (not a permanent chip wall).
 * Context/engine specials first; narrative/LLM ones labeled honestly. Studio only
 * authors the keyword strings; it never evaluates them.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { Trigger } from "../../../entities/lorebook/schema";
import styles from "./styles.module.css";

export type SpecialTriggerPreset = {
  keyword: string;
  label: string;
  group: "context" | "narrative";
  hint?: string;
};

/** Portable specials as keyword strings (RC [type:value] surface). */
export const SPECIAL_TRIGGER_PRESETS: readonly SpecialTriggerPreset[] = [
  {
    keyword: "[lorebookActive:]",
    label: "Lorebook Active",
    group: "context",
    hint: "Only trigger if another entry/lorebook is active",
  },
  {
    keyword: "[recency:5m]",
    label: "Recency",
    group: "context",
    hint: "Only trigger if messages are within a time window",
  },
  {
    keyword: "[messageCount:>=50]",
    label: "Message count",
    group: "context",
    hint: "Fire after N messages (edit the threshold in the key)",
  },
  {
    keyword: "[randomChance:25]",
    label: "Random chance",
    group: "context",
    hint: "Stochastic gate; edit the percent in the key",
  },
  {
    keyword: "[generationType:normal]",
    label: "Gen · normal",
    group: "context",
  },
  {
    keyword: "[generationType:swipe]",
    label: "Gen · swipe",
    group: "context",
  },
  {
    keyword: "[isGroupChat:true]",
    label: "Group chat",
    group: "context",
  },
  {
    keyword: "[emotion:joy]",
    label: "Emotion",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
  {
    keyword: "[mood:tense]",
    label: "Mood",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
  {
    keyword: "[timeOfDay:night]",
    label: "Time of Day",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
  {
    keyword: "[location:tavern]",
    label: "Location",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
  {
    keyword: "[weather:rain]",
    label: "Weather",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
  {
    keyword: "[activity:combat]",
    label: "Activity",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
  {
    keyword: "[relationship:allies]",
    label: "Relationship",
    group: "narrative",
    hint: "LLM-evaluated at chat runtime · Studio only stores the key",
  },
];

export interface LoreSpecialTriggersProps {
  triggers: Trigger[];
  onChange: (next: Trigger[]) => void;
  /** when true, new specials get entry-level probability stamped for advanced mode */
  advanced?: boolean;
}

export function LoreSpecialTriggers({
  triggers,
  onChange,
  advanced = false,
}: LoreSpecialTriggersProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent): void => {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const add = (keyword: string): void => {
    const k = keyword.trim();
    if (!k) return;
    if (triggers.some((t) => t.keyword === k)) {
      setOpen(false);
      return;
    }
    const t: Trigger = { keyword: k, isRegex: false };
    if (advanced) t.probability = 100;
    onChange([...triggers, t]);
    setOpen(false);
  };

  const context = SPECIAL_TRIGGER_PRESETS.filter((p) => p.group === "context");
  const narrative = SPECIAL_TRIGGER_PRESETS.filter((p) => p.group === "narrative");

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={open ? `${styles.trigger} ${styles.triggerOn}` : styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        + Condition
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Insert special condition">
          <div className={styles.section}>Engine</div>
          {context.map((p) => (
            <button
              key={p.keyword}
              type="button"
              role="menuitem"
              className={styles.item}
              title={p.hint ?? p.keyword}
              onClick={() => add(p.keyword)}
            >
              <span className={styles.itemLabel}>{p.label}</span>
              <span className={styles.itemKey}>{p.keyword}</span>
            </button>
          ))}
          <div className={styles.section}>
            Scene-aware <span className={styles.badge}>LLM</span>
          </div>
          <p className={styles.note}>
            Narrative keys need a chat runtime that evaluates them. Studio only stores the string.
          </p>
          {narrative.map((p) => (
            <button
              key={p.keyword}
              type="button"
              role="menuitem"
              className={styles.item}
              title={p.hint ?? p.keyword}
              onClick={() => add(p.keyword)}
            >
              <span className={styles.itemLabel}>
                {p.label} <span className={styles.badge}>LLM</span>
              </span>
              <span className={styles.itemKey}>{p.keyword}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
