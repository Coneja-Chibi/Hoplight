/** @jsxImportSource @opentui/react */
/**
 * A question with options, as a list you pick from.
 *
 * IT FILLS THE COMPOSER, IT DOES NOT SEND. Picking puts the value where you were already typing, so
 * you can edit it, add to it, or ignore the whole list. A row that submitted on click would hand the
 * model a way to decide when a message goes - and the moment somebody mis-clicks, they have said
 * something they did not write.
 *
 * Drawn in the family the gate and the backstage box already use: a coloured left spine, a band, a
 * recessed body. Teal, because this is Kit asking rather than Kit warning - rose is reserved for the
 * questions that carry a consequence.
 */
import { useState, type ReactNode } from "react";
import { MouseButton } from "@opentui/core";
import type { MouseEvent } from "@opentui/core";
import { theme } from "../theme";

export function ChoiceList({
  question,
  options,
  onPick,
}: {
  question: string;
  options: readonly { value: string; note?: string }[];
  onPick?: (value: string) => void;
}): ReactNode {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <box flexDirection="column" paddingTop={1}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={theme.teal} />
        <text fg={theme.quiet}>{" PICK ONE"}</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{`${options.length} options`}</text>
      </box>
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={theme.teal} />
        <text fg={theme.soft}>{` ${question}`}</text>
      </box>
      {options.map((option, index) => {
        const on = hovered === index;
        return (
          <box
            key={option.value}
            flexDirection="row"
            backgroundColor={on ? theme.lift : theme.recess}
            paddingRight={1}
            onMouseOver={() => setHovered(index)}
            onMouseOut={() => setHovered(null)}
            onMouseDown={(event: MouseEvent) => {
              if (event.button !== MouseButton.LEFT) return;
              event.preventDefault();
              onPick?.(option.value);
            }}
          >
            <box width={1} backgroundColor={theme.teal} />
            {/* The number is the keyboard route: typing it is faster than reaching for a mouse, and
                a list you can only click is the complaint that started all of this. */}
            <text fg={on ? theme.text : theme.quiet}>{` ${index + 1} `}</text>
            <text fg={on ? theme.text : theme.soft}>{option.value}</text>
            <box flexGrow={1} />
            {option.note ? <text fg={theme.quiet}>{option.note}</text> : null}
          </box>
        );
      })}
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={theme.teal} />
        <text fg={theme.quiet}>
          {"  click or press a number - it fills your message, it does not send"}
        </text>
      </box>
    </box>
  );
}
