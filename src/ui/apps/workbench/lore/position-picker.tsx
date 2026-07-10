/**
 * PositionPicker - RC-style segmented injection bar. Depth + role sit inline on the @ slot.
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

/** Primary RC-visible slots first; long-tail ST positions always available but last. */
const PRIMARY: readonly [InjectionPosition, string][] = [
  ["world", "World"],
  ["character", "Character"],
  ["scene", "Scene"],
  ["depth", "@"],
  ["append", "Append"],
  ["prepend_top", "Top"],
  ["append_bottom", "Bottom"],
  ["before_example", "Before ex."],
  ["after_example", "After ex."],
];

const ROLES: readonly MessageRole[] = ["system", "user", "assistant"];
const ROLE_SHORT: Record<MessageRole, string> = {
  system: "Sys",
  user: "User",
  assistant: "Asst",
};

export function PositionPicker({
  position,
  depth,
  role,
  showDepth,
  showRole,
  styles,
  onPatch,
}: PositionPickerProps): JSX.Element {
  const depthOn = position === "depth" || position === "append";

  return (
    <div className={styles.posRow} role="group" aria-label="Injection position">
      {PRIMARY.map(([value, label]) => {
        if (value === "depth") {
          return (
            <span
              key={value}
              className={position === "depth" ? `${styles.posDepthWrap} ${styles.posOn}` : styles.posDepthWrap}
            >
              <button
                type="button"
                className={styles.posInner}
                aria-pressed={position === "depth"}
                onClick={() => onPatch({ position: "depth" })}
              >
                {label}
              </button>
              {showDepth && (
                <input
                  className={styles.posDepthNum}
                  type="number"
                  min={0}
                  value={depth}
                  aria-label="Injection depth"
                  disabled={!depthOn}
                  onFocus={() => {
                    if (!depthOn) onPatch({ position: "depth" });
                  }}
                  onChange={(ev) => onPatch({ position: "depth", depth: Number(ev.target.value) || 0 })}
                />
              )}
              {showRole && (
                <select
                  className={styles.posRole}
                  value={role}
                  aria-label="Injected message role"
                  onChange={(ev) =>
                    onPatch({
                      position: position === "append" ? "append" : "depth",
                      role: ev.target.value as MessageRole,
                    })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_SHORT[r]}
                    </option>
                  ))}
                </select>
              )}
            </span>
          );
        }
        return (
          <button
            key={value}
            type="button"
            className={value === position ? `${styles.pos} ${styles.posOn}` : styles.pos}
            aria-pressed={value === position}
            onClick={() => onPatch({ position: value })}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
