/** @jsxImportSource @opentui/react */
/**
 * WatchNote: the transcript cue for a studio change Kit noticed happening outside itself.
 *
 * WHY IT IS A BANDED BOX RATHER THAN A LINE. It used to be one row of prose sharing the transcript's
 * own register - gold word, soft text, recess fill - and Chi's report was that it was "mixed in with
 * the regular words" and hard to read past. That is exactly right, and it is a category error rather
 * than a styling one: everything else in the transcript is somebody TALKING (you, Kit, a tool
 * reporting back), and this is the only line that is nobody talking. The building said a change
 * happened. A line that reads like speech but came from no one is the hardest kind to parse.
 *
 * So it joins the family decisions 25 and 26 already established for a framed aside: a coloured
 * left spine, a seam border, a floor fill, and a dim uppercase letterspaced header. Rehearsal wears
 * rose, backstage wears teal; the watcher wears GOLD, which is already this repo's colour for a
 * preset and for "look at this" generally. Same grammar, third sibling - nothing invented.
 *
 * The glyph is built with String.fromCodePoint because the repository forbids pictographs in TS
 * source, and opening-banner.tsx sets that precedent for the same reason.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { PathLink } from "./path-link";

/** The eye. Constructed from a scalar so the no-pictographs-in-source guard stays meaningful. */
const EYE = String.fromCodePoint(0x1f441);

export type WatchKind = "spotted" | "changed" | "left";

/** What the watcher saw, as a word rather than a colour - colour alone is not a label. */
const HEADING: Record<WatchKind, string> = {
  spotted: "NOTICED",
  changed: "CHANGED",
  left: "REMOVED",
};

/**
 * Removal gets rose, because "a piece left the studio" is the one watcher event a person may need to
 * act on. The other two are gold: something to look at, not something to worry about.
 */
const SPINE: Record<WatchKind, string> = {
  spotted: theme.gold,
  changed: theme.gold,
  left: theme.rose,
};

export function WatchNote({
  text,
  kind = "spotted",
  detail,
  path,
  onCopy,
  onNotice,
}: {
  text: string;
  kind?: WatchKind;
  /** The follow-up Kit can offer, shown in its own quiet row so it never competes with the fact. */
  detail?: string;
  /**
   * A real path on this machine, drawn as something you can act on.
   *
   * Its own row rather than inside the sentence, and that is a constraint rather than a preference:
   * the clickable form needs a box, a box cannot sit inside a line of text, and a path is usually
   * longer than the sentence around it anyway.
   */
  path?: string;
  onCopy?: (path: string) => void;
  onNotice?: (text: string) => void;
}): ReactNode {
  const spine = SPINE[kind];
  return (
    <box flexDirection="column" paddingTop={1}>
      {/* The band: darker than the transcript floor, so the eye finds its edge before reading it. */}
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={spine} />
        <text fg={spine}>{` ${EYE} `}</text>
        <text fg={theme.quiet}>{HEADING[kind]}</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>the studio changed on disk</text>
      </box>
      {/* The body sits on the recessed fill - one step DOWN from the transcript, because this is
          not part of the conversation and should read as underneath it rather than beside it. */}
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={spine} />
        <text fg={theme.soft}>{` ${text}`}</text>
      </box>
      {path ? (
        <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
          <box width={1} backgroundColor={spine} />
          <text fg={theme.quiet}>{" "}</text>
          <PathLink path={path} exists onCopy={onCopy} onNotice={onNotice} />
        </box>
      ) : null}
      {detail ? (
        <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
          <box width={1} backgroundColor={spine} />
          <text fg={theme.quiet}>{` ${detail}`}</text>
        </box>
      ) : null}
    </box>
  );
}
