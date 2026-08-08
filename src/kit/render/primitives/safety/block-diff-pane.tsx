/** @jsxImportSource @opentui/react */
/**
 * One block's rewrite, shown as a diff you can type into.
 *
 * WHY THIS EXISTS. The review card truncates every value at 48 characters, so a rewritten block read
 * as "block content rewritten -> 1": a count of edits standing in for the edit, asking somebody to
 * approve words they could not see.
 *
 * THE AFTER SIDE IS THE EDITOR. Every other review makes you approve wording you can see is nearly
 * right and then go and fix it somewhere else, which is two passes and a chance to forget the second.
 * Accepting applies WHAT IS IN THE BOX, so a nearly-right rewrite is corrected in the same breath it
 * is approved.
 *
 * THREE COLOURS, THREE AUTHORS. Teal for what the model changed, gold for what you changed over the
 * top, nothing for a line that matches what is stored - because that is not a change, whoever typed
 * it. See block-diff.ts; the marks recompute on every keystroke.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import {
  afterLines, authorGlyph, authorOf, beforeLines, tallyAuthors,
} from "../../diff/block-diff";
import type { RewrittenBlock } from "../../diff/rewritten-block";

const AUTHOR_INK: Record<string, string> = {
  stored: theme.quiet,
  model: theme.teal,
  yours: theme.gold,
};

export function BlockDiffPane({
  block,
  draft,
  editing,
  rows = 12,
}: {
  block: RewrittenBlock;
  /** What is currently in the box. Starts as the model's version. */
  draft: string;
  /** Is the cursor in the after pane? Drawn, because an invisible mode is one people fight. */
  editing?: boolean;
  /** How many lines of each side to draw before it scrolls. */
  rows?: number;
}): ReactNode {
  const lines = afterLines(block.before, block.after, draft);
  const before = beforeLines(block.before, draft);
  const tally = tallyAuthors(lines);
  const who = authorOf(block.before, block.after, draft);

  return (
    <box flexDirection="column">
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={theme.gold} />
        <text fg={theme.gold}>{" REWRITTEN"}</text>
        <text fg={theme.bright}>{`  ${block.name}`}</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{`${block.id} `}</text>
      </box>

      {/* BEFORE: read only, with the lines this rewrite drops struck through in rose. */}
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={theme.roseDeep} />
        <text fg={theme.quiet}>{" BEFORE"}</text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{"as stored "}</text>
      </box>
      {before.slice(0, rows).map((line, index) => (
        <box key={`b${String(index)}`} flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
          <box width={1} backgroundColor={line.removed ? theme.roseDeep : theme.seam} />
          <text fg={line.removed ? theme.red : theme.mut}>{line.removed ? " - " : "   "}</text>
          <text fg={line.removed ? theme.red : theme.quiet}>{line.text || " "}</text>
        </box>
      ))}
      {before.length > rows ? (
        <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
          <box width={1} backgroundColor={theme.seam} />
          <text fg={theme.mut}>{`   + ${String(before.length - rows)} more lines`}</text>
        </box>
      ) : null}

      {/* AFTER: the editor. */}
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={tally.yours > 0 ? theme.gold : theme.teal} />
        <text fg={theme.quiet}>{" AFTER"}</text>
        <box flexGrow={1} />
        <text fg={editing ? theme.gold : theme.mut}>
          {editing ? "typing · esc leaves the box " : "e edits this "}
        </text>
      </box>
      {lines.slice(0, rows).map((line, index) => (
        <box key={`a${String(index)}`} flexDirection="row" backgroundColor={theme.sunken} paddingRight={1}>
          <box width={1} backgroundColor={AUTHOR_INK[line.author] ?? theme.seam} />
          <text fg={AUTHOR_INK[line.author] ?? theme.mut}>{` ${authorGlyph(line.author)} `}</text>
          <text fg={line.author === "stored" ? theme.soft : theme.text}>{line.text || " "}</text>
          {editing && index === lines.length - 1 ? <text fg={theme.rose}>{"_"}</text> : null}
        </box>
      ))}
      {lines.length > rows ? (
        <box flexDirection="row" backgroundColor={theme.sunken} paddingRight={1}>
          <box width={1} backgroundColor={theme.seam} />
          <text fg={theme.mut}>{`   + ${String(lines.length - rows)} more lines`}</text>
        </box>
      ) : null}

      {/*
        WHO WROTE WHAT IS IN THE BOX, said plainly before anything is accepted. "stored" means the
        text is back where it started and there is nothing left to apply.
      */}
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={theme.gold} />
        <text fg={theme.quiet}>
          {who === "stored"
            ? "  back to what is stored - nothing to apply"
            : who === "model"
              ? `  ${String(tally.model)} line${tally.model === 1 ? "" : "s"} from the model`
              : `  ${String(tally.yours)} line${tally.yours === 1 ? "" : "s"} yours`}
        </text>
      </box>
    </box>
  );
}
