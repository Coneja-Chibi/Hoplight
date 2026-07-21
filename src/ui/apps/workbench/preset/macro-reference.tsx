/**
 * MacroReference - the AVAILABLE MACROS section of the EDIT PROMPT sidebar (a faithful port of RC's
 * MacroReferenceDropdown): a "Click to copy" header, bordered collapsible group boxes (icon + name +
 * count + chevron), and, when expanded, the group description over a wrapping grid of macro pills.
 * Clicking a pill copies its token (green "Copied" state, then reverts). Which GROUPS appear is
 * capability-driven: the caller passes the groups the selected Write-for lens supports
 * (macroGroupsForProfile), so RC/Hoplight show the whole engine while SillyTavern/Marinara show only
 * what they can run - the "different options per app" the fixed RC panel can't do.
 */
import { useState, type ComponentType, type JSX } from "react";
import {
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dices,
  GitBranch,
  Hash,
  IdCard,
  MessageSquare,
  Settings,
  Swords,
  Type,
  User,
  Users,
  Variable,
} from "lucide-react";
import type { MacroGroup } from "../../../../core/preset";
import s from "./macro.module.css";

type IconCmp = ComponentType<{ size?: number | string; className?: string }>;

const GROUP_ICONS: Record<string, IconCmp> = {
  Identity: User,
  "Character Card": IdCard,
  "Chat Context": MessageSquare,
  "Time & Date": Clock,
  Variables: Variable,
  "Advanced Syntax": Braces,
  "Random & Dice": Dices,
  "Text Processing": Type,
  Conditionals: GitBranch,
  Pronouns: Users,
  "Runtime & Stats": Settings,
  "Roleplay & Game": Swords,
  Lorebook: BookOpen,
};

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
      <div className={s.macrosHead}>
        <span className={s.macrosLabel}>Available macros</span>
        <span className={s.macrosHint}>Click to copy</span>
      </div>

      <div className={s.macroScroll}>
        {groups.map((g) => {
          const isOpen = open.has(g.name);
          const Icon = GROUP_ICONS[g.name] ?? Hash;
          return (
            <div key={g.name} className={s.macroGroup}>
              <button type="button" className={s.macroHead} aria-expanded={isOpen} onClick={() => toggle(g.name)}>
                <span className={s.macroHeadLeft}>
                  <Icon size={14} className={s.macroIcon} />
                  <span className={s.macroName}>{g.name}</span>
                  <span className={s.macroCount}>({g.macros.length})</span>
                </span>
                {isOpen ? <ChevronUp size={14} className={s.macroChev} /> : <ChevronDown size={14} className={s.macroChev} />}
              </button>

              {isOpen && (
                <div className={s.macroBody}>
                  <p className={s.macroGroupDesc}>{g.description}</p>
                  <div className={s.macroPills}>
                    {g.macros.map((m) => {
                      const isCopied = copied === m.macro;
                      return (
                        <button
                          key={m.macro}
                          type="button"
                          className={`${s.macroPill} ${isCopied ? s.macroPillCopied : ""}`}
                          title={m.example ? `${m.description}\nExample: ${m.example}` : m.description}
                          onClick={() => copy(m.macro)}
                        >
                          {isCopied ? (
                            <span className={s.macroPillCopiedInner}>
                              <Check size={11} />
                              Copied
                            </span>
                          ) : (
                            m.macro
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
