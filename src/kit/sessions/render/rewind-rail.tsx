/** @jsxImportSource @opentui/react */
/**
 * RewindRail: the overlay above the transcript that scrubs the current session's turns and offers the
 * two ends of one interaction: rewind (enter, discards the tail after a confirm) and branch (f, forks a
 * new session keeping the tail on disk). Turn rows come from the pure turnBounds projection; the rail
 * only holds the target index and the confirm flag, and delegates both mutations to the injected
 * actions. Guarded by busy so it can never fire mid-turn. An empty session shows nothing to rewind.
 */
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../../render/theme";
import { turnBounds } from "../projection";
import type { SessionActions } from "../session-actions";
import { TurnRow } from "./turn-row";
import { visibleWindow } from "../../render/primitives/nav/visible-window";

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

export function RewindRail({
  actions,
  busy,
  onClose,
}: {
  actions: SessionActions;
  busy: boolean;
  onClose: () => void;
}): ReactNode {
  const bounds = turnBounds(actions.current());
  const { height } = useTerminalDimensions();
  const [index, setIndex] = useState(Math.max(0, bounds.length - 1));
  const [confirming, setConfirming] = useState(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const confirmingRef = useRef(confirming);
  confirmingRef.current = confirming;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const applyIndex = (next: number): void => {
    indexRef.current = next;
    setIndex(next);
  };

  useKeyboard((event: KeyEvent) => {
    const last = bounds.length - 1;
    const target = bounds[indexRef.current];
    if (confirmingRef.current) {
      if (event.name === "escape") return setConfirming(false);
      if (event.name === "return") {
        if (target && !busyRef.current) void actions.rewind(target.turn).then(onClose);
        else setConfirming(false);
      }
      return;
    }
    switch (event.name) {
      case "escape":
        return onClose();
      case "up":
        return applyIndex(clamp(indexRef.current - 1, 0, Math.max(0, last)));
      case "down":
        return applyIndex(clamp(indexRef.current + 1, 0, Math.max(0, last)));
      case "return":
        if (target && !busyRef.current) setConfirming(true);
        return;
      case "f":
        if (target && !busyRef.current) void actions.fork(target.turn).then(onClose);
        return;
      default:
        return;
    }
  });

  const target = bounds[index];
  const turnCount = actions.current().turns.length;
  const discardCount = target ? turnCount - target.turn : 0;
  const window = visibleWindow(bounds, index, Math.max(1, height - 8));

  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <text fg={theme.rose}>Rewind</text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{String(turnCount)} turns</text>
      </box>

      {bounds.length === 0 ? (
        <box paddingLeft={1} paddingRight={1}>
          <text fg={theme.mut}>nothing to rewind · esc closes</text>
        </box>
      ) : (
        <box flexDirection="column">
          {window.items.map((bound) => (
            <TurnRow key={bound.turn} turn={bound.turn} preview={bound.preview} selected={bound.turn === target?.turn} />
          ))}
          <box height={1} backgroundColor={theme.line} />
          {confirming ? (
            <box flexDirection="row" paddingLeft={1} paddingRight={1}>
              <text fg={theme.rose}>
                discard {String(discardCount)} later turn{discardCount === 1 ? "" : "s"}?
              </text>
              <box flexGrow={1} />
              <text fg={theme.mut}>enter confirms · esc cancels</text>
            </box>
          ) : (
            <box flexDirection="row" paddingLeft={1} paddingRight={1}>
              <text fg={theme.mut}>
                <span fg={theme.soft}>up/down</span> pick{"   "}
                <span fg={theme.soft}>enter</span> rewind{"   "}
                <span fg={theme.soft}>f</span> branch{"   "}
                <span fg={theme.soft}>esc</span> cancel
              </text>
            </box>
          )}
        </box>
      )}
    </box>
  );
}
