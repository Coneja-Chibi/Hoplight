/** @jsxImportSource @opentui/react */
/**
 * SearchBar: the in-session find bar that takes the composer's slot while search is open. It owns the
 * query and the match cursor, recomputes matches from the settled transcript lines on every query or
 * lines change, and lifts the result up through onView so the shell can highlight the rows and dim the
 * inactive hits. Enter steps to the next hit, Shift+Enter to the previous (wrapping), and each step
 * pulls its line onscreen through onScrollToLine; esc closes and the shell remounts the composer. The
 * search keys are handled here with preventDefault so the input never also submits or inserts; the
 * shell must gate its own global nav keys to the not-searching case so the two never fight.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { InputRenderable, KeyEvent } from "@opentui/core";
import { theme } from "../../theme";
import { KeyHint } from "../key-hint";
import type { RenderLine } from "../../turn-events";
import { searchLines, type LineMatch } from "./search";
import { activeHit, cursorLabel, initCursor, nextMatch, prevMatch, type Hit } from "./match-cursor";

/** What the shell needs to paint the transcript: the full match set and the active hit (or null). */
export interface SearchView {
  readonly matches: readonly LineMatch[];
  readonly active: Hit | null;
}

const HINTS = [
  { key: "enter", label: "next" },
  { key: "shift+enter", label: "prev" },
  { key: "esc", label: "close" },
] as const;

export function SearchBar({
  lines,
  onClose,
  onScrollToLine,
  onView,
}: {
  lines: readonly RenderLine[];
  onClose: () => void;
  onScrollToLine: (lineIndex: number) => void;
  onView: (view: SearchView) => void;
}): ReactNode {
  const inputRef = useRef<InputRenderable | null>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(() => initCursor([]));

  // Recompute only on lines-change or query-change (settled lines, not per stream delta).
  const matches = useMemo(() => searchLines(lines, query), [lines, query]);

  // Latest callbacks in a ref so emitting them is not tied to effect deps (no churn on re-render).
  const emit = useRef({ onScrollToLine, onView });
  emit.current = { onScrollToLine, onView };

  const publish = (view: SearchView): void => {
    emit.current.onView(view);
    if (view.active) emit.current.onScrollToLine(view.active.lineIndex);
  };

  // A new match set resets the cursor to the first hit and pulls it into view.
  useEffect(() => {
    const next = initCursor(matches);
    setCursor(next);
    publish({ matches, active: activeHit(next) });
  }, [matches]);

  // cursor is the latest render's value (useKeyboard runs the current closure), so no functional
  // updater is needed; the side effects stay out of the setState call.
  const step = (backward: boolean): void => {
    const next = backward ? prevMatch(cursor) : nextMatch(cursor);
    setCursor(next);
    publish({ matches, active: activeHit(next) });
  };

  useKeyboard((event: KeyEvent) => {
    if (event.name === "escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.name === "return") {
      event.preventDefault();
      if (matches.length > 0) step(event.shift === true);
    }
  });

  const trimmed = query.trim();
  const label = trimmed === "" ? "" : cursorLabel(cursor);
  const labelColor = matches.length === 0 ? theme.mut : theme.bright;

  return (
    <box flexDirection="column" backgroundColor={theme.well} paddingLeft={1} paddingRight={1}>
      <box height={1} />
      <box
        flexDirection="row"
        height={3}
        border
        borderStyle="heavy"
        borderColor={theme.line}
        backgroundColor={theme.panel}
        paddingRight={1}
      >
        <box backgroundColor={theme.tealDeep} paddingLeft={1} paddingRight={1}>
          <text fg={theme.white}>find</text>
        </box>
        <box width={1} />
        <input
          ref={inputRef}
          focused
          flexGrow={1}
          value={query}
          placeholder="search the transcript"
          onInput={setQuery}
        />
        <box width={1} />
        <text fg={labelColor}>{label}</text>
      </box>
      <box flexDirection="row" paddingLeft={1}>
        <KeyHint hints={HINTS} />
      </box>
    </box>
  );
}
