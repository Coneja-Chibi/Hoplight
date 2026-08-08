/** @jsxImportSource @opentui/react */
/**
 * One answer on a gate, as a real bordered target.
 *
 * Shared because both surfaces that ask a question use it - the review card and the crossing panel -
 * and a second copy would be the first thing to drift on the day one of them grew a new answer.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
/** One glyph-led choice. A real bordered target, so the mouse works where it never used to. */
export function GateButton({
  glyph,
  label,
  tone,
  onPress,
  focused,
}: {
  glyph: string;
  label: string;
  tone: string;
  onPress: () => void;
  /**
   * Whether the keyboard cursor is on this button.
   *
   * The gate always had y / a / n bound, and Levi still read it as mouse-only - correctly, because
   * nothing on screen said otherwise. Three bordered buttons with no cursor look like three things
   * you click. A visible selection is what makes the keyboard discoverable; the letter shortcuts and
   * the mouse both still work, and neither was taken away to add this.
   */
  focused?: boolean;
}): ReactNode {
  return (
    <box flexDirection="row">
      <box
        border
        borderStyle={focused ? "heavy" : "single"}
        borderColor={focused ? tone : theme.line}
        backgroundColor={focused ? theme.lift : undefined}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={onPress}
      >
        <text fg={focused ? theme.text : theme.soft}>
          <span fg={tone}>{glyph}</span> {label}
        </text>
      </box>
      <box width={1} />
    </box>
  );
}
