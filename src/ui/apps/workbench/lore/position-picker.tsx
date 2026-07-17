/**
 * Placement stop-rail. Stops from placementRailStops (depth-like last). @ depth is an
 * end-cap that arms on depth-like positions. Single-slot hosts get a quiet floor line.
 */
import type { JSX } from "react";
import type { InjectionPosition, MessageRole } from "../../../../entities/lorebook/schema";
import {
  isDepthLikePosition,
  placementRailStops,
  type LoreWriteForProfile,
} from "../../../../core/lore";

export interface PositionPickerProps {
  position: InjectionPosition;
  depth: number;
  role: MessageRole;
  writeFor: LoreWriteForProfile;
  showDepth: boolean;
  showRole: boolean;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: { position?: InjectionPosition; depth?: number; role?: MessageRole }) => void;
}

/** Short rail labels. */
const RAIL_LABEL: Record<InjectionPosition, string> = {
  world: "World",
  character: "Char",
  scene: "Scene",
  depth: "Depth",
  append: "Append",
  prepend_top: "Top",
  append_bottom: "Bot",
  before_example: "Bef.ex",
  after_example: "Aft.ex",
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
  writeFor,
  showDepth,
  showRole,
  styles,
  onPatch,
}: PositionPickerProps): JSX.Element {
  const profileStops = placementRailStops(writeFor);
  const stops = placementRailStops(writeFor, position);
  const isForeign = !profileStops.includes(position);
  const depthOn = isDepthLikePosition(position);
  const idx = Math.max(0, stops.indexOf(position));
  const pct = stops.length <= 1 ? 0 : (idx / (stops.length - 1)) * 100;

  if (profileStops.length <= 1) {
    return (
      <div className={styles.placeFloor} role="group" aria-label="Injection position">
        <span className={styles.placeFloorLine}>
          Character floor · this host has no placement dial
        </span>
        {isForeign && (
          <span className={styles.placeForeign} title="Set under another platform">
            held as {RAIL_LABEL[position] ?? position}
            {isDepthLikePosition(position) ? ` @${depth}` : ""}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.placeRail} role="group" aria-label="Injection position">
      {(showDepth || showRole) && (
        <div className={styles.placeHead}>
          {showDepth && (
            <span
              className={
                depthOn ? styles.placeDepthCap : `${styles.placeDepthCap} ${styles.placeDepthSleep}`
              }
            >
              <span className={styles.placeAt} aria-hidden="true">
                @
              </span>
              <input
                className={styles.placeDepthNum}
                type="number"
                inputMode="numeric"
                min={0}
                value={depth}
                aria-label="Injection depth"
                disabled={!depthOn}
                onFocus={(ev) => {
                  ev.currentTarget.select();
                  if (!depthOn) onPatch({ position: "depth" });
                }}
                onChange={(ev) =>
                  onPatch({
                    position: depthOn ? position : "depth",
                    depth: Number(ev.target.value) || 0,
                  })
                }
              />
              {showRole && depthOn && (
                <select
                  className={styles.placeRole}
                  value={role}
                  aria-label="Injected message role"
                  onChange={(ev) =>
                    onPatch({
                      position: isDepthLikePosition(position) ? position : "depth",
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
          )}
        </div>
      )}
      {/* Equal-width stop cells: no absolute labels (they smush past ~5 stops) */}
      <div className={styles.placeStops} style={{ ["--n" as string]: String(stops.length) }}>
        <div className={styles.placeLine} aria-hidden="true">
          <span className={styles.placeFill} style={{ width: `${pct}%` }} />
          <span className={styles.placeThumb} style={{ left: `${pct}%` }} />
        </div>
        <div className={styles.placeStopRow}>
          {stops.map((slot) => {
            const on = slot === position;
            const foreignSlot = isForeign && slot === position;
            return (
              <button
                key={slot}
                type="button"
                className={
                  on
                    ? `${styles.placeStop} ${styles.placeStopOn}${foreignSlot ? ` ${styles.placeLblForeign}` : ""}`
                    : styles.placeStop
                }
                aria-pressed={on}
                title={
                  foreignSlot
                    ? "Set by another platform; this host will place it at its closest slot on export"
                    : RAIL_LABEL[slot]
                }
                onClick={() => onPatch({ position: slot })}
              >
                <span
                  className={on ? `${styles.placeDot} ${styles.placeDotOn}` : styles.placeDot}
                  aria-hidden="true"
                />
                <span className={styles.placeStopLbl}>{RAIL_LABEL[slot]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
