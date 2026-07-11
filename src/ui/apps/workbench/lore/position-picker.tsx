/**
 * PositionPicker - segmented injection bar. Depth + role sit inline on the @ slot. Which slots
 * render comes from the capabilities matrix (positionsForProfile), NEVER a local list: the lens
 * shows only slots its wire can carry. If the entry's current position is foreign to the lens it
 * still renders (marked off-target) - hiding never lies about data.
 */
import type { JSX } from "react";
import type { InjectionPosition, MessageRole } from "../../../../entities/lorebook/schema";

export interface PositionPickerProps {
  position: InjectionPosition;
  depth: number;
  role: MessageRole;
  /** slots the active Write-for lens carries (positionsForProfile(writeFor)) */
  allowed: readonly InjectionPosition[];
  showDepth: boolean;
  showRole: boolean;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: { position?: InjectionPosition; depth?: number; role?: MessageRole }) => void;
}

/** UI labels only; availability is the capability matrix's job. */
const POSITION_LABELS: Record<InjectionPosition, string> = {
  world: "World",
  character: "Character",
  scene: "Scene",
  depth: "@",
  append: "Append",
  prepend_top: "Top",
  append_bottom: "Bottom",
  before_example: "Before ex.",
  after_example: "After ex.",
};

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
  allowed,
  showDepth,
  showRole,
  styles,
  onPatch,
}: PositionPickerProps): JSX.Element {
  const depthOn = position === "depth" || position === "append";
  const foreign = !allowed.includes(position);
  const slots: readonly InjectionPosition[] = foreign ? [...allowed, position] : allowed;

  return (
    <div className={styles.posRow} role="group" aria-label="Injection position">
      {slots.map((value) => {
        const isForeignSlot = value === position && foreign;
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
                {POSITION_LABELS[value]}
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
            className={
              value === position
                ? `${styles.pos} ${styles.posOn}${isForeignSlot ? ` ${styles.posForeign}` : ""}`
                : styles.pos
            }
            aria-pressed={value === position}
            title={isForeignSlot ? "Set by another platform; this host will place it at its closest slot on export" : undefined}
            onClick={() => onPatch({ position: value })}
          >
            {POSITION_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
