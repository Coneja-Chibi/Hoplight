/** @jsxImportSource @opentui/react */
/**
 * HelpScreen: the full-screen help stage, a view swap like settings-screen. It builds its grouped
 * model once from the command registry plus the keybinding catalog, draws the sections in one
 * scrolling content pane, and routes every keypress through the pure reduce (up/down and PgUp/PgDn
 * scroll, esc or q close). Because help is a view swap, the composer and its global listeners are
 * unmounted while it is up, so there is no key contention to guard here. esc always closes, even
 * mid-scroll, so the overlay can never trap the user.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { theme } from "../../theme";
import { KeyHint } from "../key-hint";
import { KEYMAP } from "./keymap";
import { buildHelp, initHelp, reduce, type HelpCommand, type HelpSection } from "./help-model";

const COL = 24; // the keys column width; notes align to its right

const sectionNodes = (section: HelpSection, key: string): ReactNode[] => {
  const nodes: ReactNode[] = [
    <text key={`${key}-h`} fg={theme.quiet}>
      {section.title}
    </text>,
  ];
  section.rows.forEach((row, index) => {
    const keys = row.keys.length >= COL ? `${row.keys}  ` : row.keys.padEnd(COL, " ");
    nodes.push(
      <text key={`${key}-r${index}`}>
        <span fg={theme.quiet}>{"   "}</span>
        <span fg={theme.text}>{keys}</span>
        <span fg={theme.soft}>{row.note}</span>
      </text>,
    );
  });
  return nodes;
};

export function HelpScreen({
  commands,
  onClose,
  studioName = "Hoplight Studio",
}: {
  commands: readonly HelpCommand[];
  onClose: () => void;
  studioName?: string;
}): ReactNode {
  const model = useMemo(() => buildHelp(commands, KEYMAP), [commands]);
  const [state, setState] = useState(initHelp);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    if (!state.open) onClose();
  }, [state.open, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo(state.scroll); // the renderable clamps an over-scroll internally
  }, [state.scroll]);

  useKeyboard((event: KeyEvent) => setState((prev) => reduce(prev, { name: event.name })));

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.well}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text>
          <span fg={theme.text}>Kit</span>
          <span fg={theme.rose}>.</span> <span fg={theme.quiet}>help</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{studioName}</text>
      </box>
      <box height={1} backgroundColor={theme.edge} />

      <box flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0}>
        <scrollbox ref={scrollRef} height="100%" scrollY paddingLeft={1} paddingRight={1} paddingTop={1} gap={1}>
          {model.sections.length === 0 ? (
            <text fg={theme.quiet}>No commands or keys are registered yet.</text>
          ) : (
            model.sections.flatMap((section, index) => sectionNodes(section, `s${index}`))
          )}
        </scrollbox>
      </box>

      <box height={1} backgroundColor={theme.edge} />
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <KeyHint hints={[{ key: "up/down", label: "scroll" }, { key: "esc", label: "close" }]} />
      </box>
    </box>
  );
}
