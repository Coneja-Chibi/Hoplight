/** @jsxImportSource @opentui/react */
/**
 * The format-crossing panel: what an export would lose, and the third answer.
 *
 * Its own file because it is its own surface. It shares only the gate's choice type with the review
 * card - different question, different keys, different shape - and keeping them together was what
 * pushed gate-prompt.tsx past its line cap when the rewrite diff arrived.
 */
import { useState, type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../../theme";
import { BAR, CHECK, CROSS, HELD, STOP } from "../../glyphs";
import { KeyHint } from "../key-hint";
import { GateButton } from "./gate-button";
import { stripeFor } from "../../../tools/safety/stripe-core";
import type { PermissionMode } from "../../../tools/safety/gate-core";
import type { GateChoice } from "../../../tools/safety/permission-mode";
import {
  crossingIsLossy, crossingLegend,
  type CrossingReview, type CrossingRow, type CrossingSeverity,
} from "../../../changes/crossing";
/**
 * The crossing ledger: what each thing is, and what becomes of it on the other side.
 *
 * TWO COLUMNS, NOT BEFORE-AND-AFTER ROWS. A draft's honest shape is a field changing value. A
 * crossing's is a thing meeting an engine that may not have it, so the right column is a fate rather
 * than a new value, and reading across one row answers the whole question for that thing.
 *
 * BANDED BY SEVERITY, WORST FIRST. The stripe already means risk everywhere else in Kit, so severity
 * needs no legend. Blank rows separate the bands because a removal and a respelling are different
 * kinds of news and a flat list makes them look like one.
 *
 * THE THIRD ANSWER IS THE POINT. `y` and `n` force a decision from someone who may not know what a
 * loss costs. `t` holds the crossing and asks Kit, which is the one participant that already measured
 * it. The gate closes either way - it cannot stay open across turns - so holding returns a distinct
 * choice the shell turns into a question rather than a silent discard.
 */
const SEVERITY_TONE: Record<CrossingSeverity, string> = {
  removed: theme.red,
  rewritten: theme.gold,
  carried: theme.teal,
};

export function CrossingPanel({
  review,
  mode,
  onChoice,
}: {
  review: CrossingReview;
  mode: PermissionMode;
  onChoice: (choice: GateChoice) => void;
}): ReactNode {
  const lossy = crossingIsLossy(review);
  const [hovered, setHovered] = useState<number | null>(null);

  useKeyboard((e: KeyEvent) => {
    const k = e.name;
    if (k === "y" || k === "return") {
      e.preventDefault();
      onChoice({ type: "allow-once" });
    } else if (k === "t") {
      e.preventDefault();
      onChoice({ type: "hold" });
    } else if (k === "n" || k === "d" || k === "escape") {
      e.preventDefault();
      onChoice({ type: "deny" });
    }
  });

  // Blank separators between bands, computed from the rows rather than hand-placed, so a crossing
  // with no removals does not open on an empty gap.
  const rows: (CrossingRow | null)[] = [];
  let previous: CrossingSeverity | null = null;
  for (const row of review.rows) {
    if (previous !== null && row.severity !== previous) rows.push(null);
    rows.push(row);
    previous = row.severity;
  }

  // The key when nothing is hovered; that row's own reason when something is. A hovered row with no
  // note falls back to the key rather than blanking, so the line never empties under the pointer.
  const legend = crossingLegend(review);
  const footLine = (hovered === null ? null : rows[hovered]?.note) ?? legend;

  return (
    <box
      flexDirection="column"
      border
      borderColor={lossy ? theme.gold : theme.line}
      backgroundColor={theme.panel}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row">
        <text fg={theme.rose}>REVIEW CROSSING</text>
        <box flexGrow={1} />
        <text fg={theme.soft}>{mode}</text>
      </box>
      <text fg={theme.bright}>
        {review.target.kind} / {review.target.id}
        <span fg={theme.quiet}> {"->"} {review.to}</span>
      </text>
      <box height={1} />

      <box flexDirection="row">
        <text fg={theme.quiet}>{"  "}from</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>becomes{"  "}</text>
      </box>

      {rows.map((row, index) =>
        row === null ? (
          <box key={index} height={1} />
        ) : (
          <box
            key={index}
            flexDirection="column"
            // Hover writes to the foot line and NEVER to this row. Revealing the note here would
            // push every row below it down, moving the thing under the pointer as it is read.
            onMouseOver={() => setHovered(index)}
            onMouseOut={() => setHovered((current) => (current === index ? null : current))}
            backgroundColor={hovered === index ? theme.row : undefined}
          >
            <box flexDirection="row">
              <text fg={SEVERITY_TONE[row.severity]}>{BAR}</text>
              <text fg={theme.soft}>
                {" "}{row.from}
                {row.count === undefined ? "" : ` x${row.count}`}
              </text>
              <box flexGrow={1} />
              <text fg={SEVERITY_TONE[row.severity]}>{row.to}</text>
            </box>
            {row.where ? <text fg={theme.quiet}>{"    in "}{row.where}</text> : null}
          </box>
        ),
      )}

      {review.escrowDropped ? (
        <>
          <box height={1} />
          {/* Reassurance, deliberately out of the severity list: nothing here is lost to the user,
              only to the file, and colouring it like damage would have said the opposite. */}
          <text fg={theme.quiet}>
            The original is not written to the file. Hoplight keeps it, so converting back restores it.
          </text>
        </>
      ) : null}
      {review.warningCount > 0 ? (
        <text fg={theme.gold}>
          {String(review.warningCount)} warning{review.warningCount === 1 ? "" : "s"}
        </text>
      ) : null}

      {/*
        One fixed line, always present, whatever is hovered. It carries the key by default and one
        row's reason while that row is under the pointer. Fixed because the alternative - growing the
        panel when a note appears - moves every button below it, and a confirm whose buttons move
        while you read is a confirm you can misclick.
      */}
      {footLine ? (
        <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
          <text fg={hovered === null ? theme.mut : theme.soft}>{footLine}</text>
        </box>
      ) : null}

      <box height={1} />
      <box flexDirection="row">
        <GateButton
          glyph={CHECK}
          label="Write it"
          tone={theme.teal}
          onPress={() => onChoice({ type: "allow-once" })}
        />
        <GateButton
          glyph={HELD}
          label="Talk it through"
          tone={theme.violet}
          onPress={() => onChoice({ type: "hold" })}
        />
        <GateButton
          glyph={CROSS}
          label="Discard"
          tone={theme.red}
          onPress={() => onChoice({ type: "deny" })}
        />
      </box>
      <text fg={theme.mut}>enter writes · esc discards</text>
    </box>
  );
}
