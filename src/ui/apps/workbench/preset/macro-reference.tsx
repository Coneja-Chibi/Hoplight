/**
 * MacroReference - the AVAILABLE MACROS section of the EDIT PROMPT sidebar (transcribed from RC's
 * MacroReferenceDropdown). Collapsible groups; each head shows its macro count; a macro row copies
 * its token to the clipboard on click (content is edited inline, so copy-then-paste is the flow).
 * Which GROUPS appear is capability-driven: the caller passes the groups the selected Write-for lens
 * supports (macroGroupsForProfile), so RC/Vaude show the whole engine while SillyTavern/Marinara
 * show only what they can run. This is the "different options per app" the fixed RC panel can't do.
 */
import { useState, type JSX } from "react";
import type { MacroGroup } from "../../../../core/preset";
import s from "./sidebar.module.css";

export interface MacroReferenceProps {
  groups: MacroGroup[];
}

export function MacroReference({ groups }: MacroReferenceProps): JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (name: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const copy = (macro: string): void => {
    void navigator.clipboard?.writeText(macro);
    setCopied(macro);
  };

  return (
    <div className={s.macros}>
      <span className={s.sideAdvancedLabel}>Available macros</span>
      {groups.map((g) => {
        const isOpen = open.has(g.name);
        return (
          <div key={g.name} className={s.macroGroup}>
            <button
              type="button"
              className={s.macroHead}
              aria-expanded={isOpen}
              onClick={() => toggle(g.name)}
            >
              <span className={s.macroChev} data-open={isOpen || undefined}>
                &#8250;
              </span>
              <span className={s.macroName}>{g.name}</span>
              <span className={s.macroCount}>{g.macros.length}</span>
            </button>
            {isOpen && (
              <ul className={s.macroList}>
                {g.macros.map((m) => (
                  <li key={m.macro}>
                    <button
                      type="button"
                      className={s.macroItem}
                      title={m.example ? `${m.description} — e.g. ${m.example}` : m.description}
                      onClick={() => copy(m.macro)}
                    >
                      <code className={s.macroCode}>{m.macro}</code>
                      <span className={s.macroDesc}>{copied === m.macro ? "copied" : m.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
