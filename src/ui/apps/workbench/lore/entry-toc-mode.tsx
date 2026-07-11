/**
 * Fire-mode dropdown for TOC rows: Keywords / Always on / By meaning (icons + color).
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { KeyRound, Pin, Sparkles } from "lucide-react";
import { type EntryFireMode } from "./entry-fire-mode";

const ICO = { size: 12, strokeWidth: 2.25, "aria-hidden": true as const };

const MODE_OPTS: readonly {
  mode: EntryFireMode;
  label: string;
  Icon: typeof KeyRound;
}[] = [
  { mode: "keyed", label: "Keywords", Icon: KeyRound },
  { mode: "always", label: "Always on", Icon: Pin },
  { mode: "meaning", label: "By meaning", Icon: Sparkles },
];

function modeTone(mode: EntryFireMode, styles: Readonly<Record<string, string>>): string {
  if (mode === "always") return styles.modeAlways ?? "";
  if (mode === "meaning") return styles.modeMeaning ?? "";
  return styles.modeKey ?? "";
}

export function ModeSelect({
  mode,
  vectorOk,
  styles,
  onChange,
}: {
  mode: EntryFireMode;
  vectorOk: boolean;
  styles: Readonly<Record<string, string>>;
  onChange: (mode: EntryFireMode) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const current = MODE_OPTS.find((o) => o.mode === mode) ?? MODE_OPTS[0]!;
  const CurIcon = current.Icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent): void => {
      if (wrap.current && !wrap.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={styles.modeSelect} ref={wrap}>
      <button
        type="button"
        className={`${styles.modeTrigger} ${modeTone(mode, styles)}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Trigger method: ${current.label}`}
        title={current.label}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <CurIcon {...ICO} />
        <span>{current.label}</span>
      </button>
      {open && (
        <ul className={styles.modeMenu} role="listbox" aria-label="Trigger method">
          {MODE_OPTS.map(({ mode: m, label, Icon }) => {
            const gated = m === "meaning" && !vectorOk;
            return (
              <li key={m}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m === mode}
                  disabled={gated}
                  className={[
                    styles.modeOpt,
                    modeTone(m, styles),
                    m === mode ? styles.modeOptOn : "",
                    gated ? styles.modeOptGated : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={
                    gated
                      ? "This host cannot carry by-meaning (vectorized) entries."
                      : label
                  }
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (gated) return;
                    onChange(m);
                    setOpen(false);
                  }}
                >
                  <Icon {...ICO} />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
