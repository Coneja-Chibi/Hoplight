/** @jsxImportSource @opentui/react */
/**
 * SearchCard: transcript find as a SCRIPT VIEW (Chi's VAUDEVILLE look, locked 2026-07-24). ctrl+f opens
 * it over the transcript; each matching line reads as a screenplay line, an ALL-CAPS speaker cue colored
 * by voice (YOU rose, KIT teal, REHEARSAL violet, ERROR red), the matched dialogue beneath with the term
 * in gold, and the active line's left margin lit in the speaker's colour. It owns the query and a simple
 * per-line cursor (up/down walk the matching lines, wrapping); the search keys are handled with
 * preventDefault so the input never also submits. esc / enter close. No regex is built from the query
 * (searchLines is includes-only), so there is no ReDoS surface.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../../theme";
import type { RenderLine } from "../../turn-events";
import { searchLines, lineText, type Range } from "./search";
import { cap99 } from "./cap";
import { visibleWindow } from "./visible-window";

const VOICE: Record<string, { label: string; color: string }> = {
  you: { label: "YOU", color: "#f0768f" },
  reh: { label: "REHEARSAL", color: "#b79cf5" },
  err: { label: "ERROR", color: theme.red },
  kit: { label: "KIT", color: "#4fd6c0" },
};

/** The screenplay speaker cue for a transcript line: your voice, the studio's, a rehearsal, or an error. */
function speakerOf(line: RenderLine): { label: string; color: string } {
  switch (line.role) {
    case "you":
      return VOICE.you!;
    case "thought":
      return VOICE.reh!;
    case "error":
      return VOICE.err!;
    default:
      return VOICE.kit!; // say / tool / backstage all speak in Kit's voice
  }
}

/** Split a line into nodes with the matched ranges gold + underlined (the found term), the rest soft. */
function highlighted(text: string, ranges: readonly Range[]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    const lo = Math.max(0, Math.min(r[0], text.length));
    const hi = Math.max(lo, Math.min(r[1], text.length));
    if (lo > at) out.push(<span key={`t${i}`}>{text.slice(at, lo)}</span>);
    out.push(
      <u key={`m${i}`}>
        <span fg={theme.gold}>{text.slice(lo, hi)}</span>
      </u>,
    );
    at = hi;
  });
  if (at < text.length) out.push(<span key="tail">{text.slice(at)}</span>);
  return out;
}

export function SearchCard({ lines, onClose }: { lines: readonly RenderLine[]; onClose: () => void }): ReactNode {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const { height } = useTerminalDimensions();
  const matches = useMemo(() => searchLines(lines, query), [lines, query]);

  // A new match set points back at the first line.
  useEffect(() => {
    setIndex(0);
  }, [matches]);

  const step = (backward: boolean): void => {
    if (matches.length === 0) return;
    setIndex((i) => (backward ? i - 1 + matches.length : i + 1) % matches.length);
  };

  useKeyboard((event: KeyEvent) => {
    if (event.name === "escape" || (event.ctrl && event.name === "f")) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.name === "return") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.name === "up") {
      event.preventDefault();
      step(true);
      return;
    }
    if (event.name === "down") {
      event.preventDefault();
      step(false);
    }
  });

  const trimmed = query.trim();
  const activeIndex = matches.length === 0 ? 0 : Math.min(index, matches.length - 1);
  const window = visibleWindow(matches, activeIndex, Math.max(1, Math.floor((height - 8) / 2)));
  const count = matches.length === 0 ? (trimmed ? "no matches" : "") : `${activeIndex + 1}/${cap99(matches.length)}`;

  return (
    <box flexDirection="column" backgroundColor={theme.panel} border borderColor={theme.line}>
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <text fg={theme.gold}>SEARCH </text>
        <input focused flexGrow={1} placeholder="search the script" onInput={setQuery} />
        <text fg={theme.soft}>{count}</text>
        <text fg={theme.quiet}> {"  up/down · enter · esc"}</text>
      </box>
      <box flexDirection="column">
        {matches.length === 0 ? (
          <box paddingLeft={1} paddingRight={1}>
            <text fg={theme.quiet}>{trimmed ? "No matches in this transcript." : "Type to search the script."}</text>
          </box>
        ) : (
          window.items.map((match, slot) => {
            const i = window.start + slot;
            const line = lines[match.lineIndex]!;
            const speaker = speakerOf(line);
            const on = i === index;
            return (
              <box key={i} flexDirection="row" backgroundColor={on ? theme.lift : theme.panel}>
                <box width={1} backgroundColor={on ? speaker.color : theme.panel} />
                <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
                  <text fg={speaker.color}>{speaker.label}</text>
                  <text fg={theme.soft}>
                    {"  "}
                    {highlighted(lineText(line), match.ranges)}
                  </text>
                </box>
              </box>
            );
          })
        )}
      </box>
    </box>
  );
}
