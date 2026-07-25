/** @jsxImportSource @opentui/react */
/**
 * Full-screen Panel Deck browser for semantic capabilities, organized by piece, area, and action.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import type { EntitySummary } from "../../bridge";
import type { ContentCapability } from "../../../entities/capabilities";
import { theme } from "../theme";
import { KeyHint } from "../primitives/key-hint";
import { Panel } from "../settings/panel";
import {
  initialToolsState,
  reduceTools,
  toolsActions,
  toolsAreas,
  type ToolsState,
} from "./model";

const Row = ({
  text,
  selected,
  onPick,
}: {
  text: string;
  selected: boolean;
  onPick: () => void;
}): ReactNode => (
  <box
    flexDirection="row"
    backgroundColor={selected ? theme.row : theme.panel}
    paddingRight={1}
    onMouseDown={onPick}
  >
    <text fg={theme.rose}>{selected ? "| " : "  "}</text>
    <text fg={selected ? theme.text : theme.soft}>{text}</text>
  </box>
);

export function ToolsScreen({
  pieces,
  capabilities,
  studioName,
  onClose,
}: {
  pieces: readonly EntitySummary[];
  capabilities: readonly ContentCapability[];
  studioName: string;
  onClose: () => void;
}): ReactNode {
  const [state, setState] = useState(initialToolsState);
  const { width } = useTerminalDimensions();
  const compact = width < 72;
  const areas = toolsAreas(state, pieces, capabilities);
  const actions = toolsActions(state, pieces, capabilities);
  const selected = actions[state.action];

  const choose = (patch: Partial<ToolsState>): void =>
    setState((current) => ({ ...current, ...patch }));

  useKeyboard((event: KeyEvent) => {
    const step = reduceTools(state, event.name, pieces, capabilities);
    if (step.close) onClose();
    else setState(step.state);
  });

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.well}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text><span fg={theme.text}>Kit</span><span fg={theme.rose}>.</span> <span fg={theme.quiet}>tools</span></text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{studioName}</text>
      </box>
      <box height={1} backgroundColor={theme.edge} />
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <Panel index={1} title="piece" focused={state.pane === 0} visible={!compact || state.pane === 0}>
          {pieces.length ? pieces.map((piece, index) => (
            <Row
              key={`${piece.kind}/${piece.id}`}
              text={`${piece.name} · ${piece.kind}`}
              selected={state.pane === 0 && state.target === index}
              onPick={() => choose({ pane: 0, target: index, area: 0, action: 0 })}
            />
          )) : <text fg={theme.quiet}>  No pieces in this studio.</text>}
        </Panel>
        <Panel index={2} title="area" focused={state.pane === 1} visible={!compact || state.pane === 1}>
          {areas.length ? areas.map((area, index) => (
            <Row
              key={area}
              text={area}
              selected={state.pane === 1 && state.area === index}
              onPick={() => choose({ pane: 1, area: index, action: 0 })}
            />
          )) : <text fg={theme.quiet}>  No actions for this piece yet.</text>}
        </Panel>
        <Panel index={3} title="actions" focused={state.pane === 2} visible={!compact || state.pane === 2}>
          {actions.length ? actions.map((action, index) => (
            <Row
              key={action.id}
              text={action.action}
              selected={state.pane === 2 && state.action === index}
              onPick={() => choose({ pane: 2, action: index })}
            />
          )) : <text fg={theme.quiet}>  Choose an available area.</text>}
          {selected ? (
            <box flexDirection="column" marginTop={1} paddingLeft={2} paddingRight={1}>
              <text fg={theme.text}>{selected.summary}</text>
              <text fg={theme.quiet}>platforms: {selected.platforms === "canonical" ? "canonical" : selected.platforms.join(", ")}</text>
              <text fg={theme.teal}>Previews a draft. Nothing is saved until change_apply passes the Gate.</text>
            </box>
          ) : null}
        </Panel>
      </box>
      <box height={1} backgroundColor={theme.edge} />
      <box backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <KeyHint hints={[
          { key: "left/right", label: "pane" },
          { key: "up/down", label: "choose" },
          { key: "esc", label: "close" },
        ]} />
      </box>
    </box>
  );
}
