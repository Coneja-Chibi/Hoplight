/**
 * PositionPicker - the desk's injection-position chip row (vs-lorebook-desk-f). One chip per
 * canonical position; the depth/role dials appear inline only when the chosen position uses them.
 */
import type { JSX } from "react";
import type { InjectionPosition, MessageRole } from "../../../../entities/lorebook/schema";

export interface PositionPickerProps {
  position: InjectionPosition;
  depth: number;
  role: MessageRole;
  showDepth: boolean;
  showRole: boolean;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: { position?: InjectionPosition; depth?: number; role?: MessageRole }) => void;
}

/** plain-words chip labels; the canonical ids stay internal */
const POSITION_LABELS: readonly [InjectionPosition, string][] = [
  ["world", "World"],
  ["character", "Character"],
  ["scene", "Scene"],
  ["depth", "@ depth"],
  ["append", "Append"],
  ["prepend_top", "Top"],
  ["append_bottom", "Bottom"],
  ["before_example", "Before examples"],
  ["after_example", "After examples"],
];

const ROLES: readonly MessageRole[] = ["system", "user", "assistant"];

export function PositionPicker({
  position,
  depth,
  role,
  showDepth,
  showRole,
  styles,
  onPatch,
}: PositionPickerProps): JSX.Element {
  const needsDepth = position === "depth" || position === "append";
  return (
    <div className={styles.posRow} role="group" aria-label="Injection position">
      {POSITION_LABELS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={value === position ? `${styles.pos} ${styles.posOn}` : styles.pos}
          aria-pressed={value === position}
          onClick={() => onPatch({ position: value })}
        >
          {label}
        </button>
      ))}
      {needsDepth && showDepth && (
        <label className={styles.posDial}>
          <span className={styles.dialLabel}>depth</span>
          <input
            className={styles.num}
            type="number"
            min={0}
            value={depth}
            aria-label="Injection depth"
            onChange={(ev) => onPatch({ depth: Number(ev.target.value) || 0 })}
          />
        </label>
      )}
      {needsDepth && showRole && (
        <label className={styles.posDial}>
          <span className={styles.dialLabel}>as</span>
          <select
            className={styles.miniSel}
            value={role}
            aria-label="Injected message role"
            onChange={(ev) => onPatch({ role: ev.target.value as MessageRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
