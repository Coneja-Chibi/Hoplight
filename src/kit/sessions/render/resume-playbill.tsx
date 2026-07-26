/** @jsxImportSource @opentui/react */
/**
 * ResumePlaybill: the full-screen sessions list, Kit's third app view (mirrors settings-screen.tsx).
 * It loads summaries from the store through ctx.sessions, routes keys through a small local mode
 * machine (browse / renaming / deleting), and delegates every real operation to the injected actions;
 * all derivation (titles, previews, relative time, fork lineage) comes from the tested pure cores, so
 * this shell only holds cursor + mode state. Every mutating key is guarded by busy so nothing changes
 * mid-turn. Keyboard reads a ref mirror of state so a burst of keys never chains off a stale closure.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../../render/theme";
import type { SessionSummary } from "../projection";
import type { SessionActions } from "../session-actions";
import { relativeTime } from "./relative-time";
import { SessionCard } from "./session-card";
import { visibleWindow } from "../../render/primitives/nav/visible-window";
import { dropLastGrapheme } from "../../_shared/graphemes";

type Mode = { kind: "browse" } | { kind: "renaming"; draft: string } | { kind: "deleting" };

interface PlaybillView {
  summaries: SessionSummary[];
  index: number;
  mode: Mode;
}

const printable = (event: KeyEvent): string | undefined => {
  if (event.ctrl || event.meta || event.option || event.super) return undefined;
  const seq = event.sequence;
  if (typeof seq === "string" && seq.length === 1 && seq >= " " && seq !== "") return seq;
  return undefined;
};

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

export function ResumePlaybill({
  actions,
  busy,
  onClose,
}: {
  actions: SessionActions;
  busy: boolean;
  onClose: () => void;
}): ReactNode {
  const [view, setView] = useState<PlaybillView>({ summaries: [], index: 0, mode: { kind: "browse" } });
  const { height } = useTerminalDimensions();
  const ref = useRef<PlaybillView>(view);
  ref.current = view;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const alive = useRef(true);

  const apply = useCallback((next: PlaybillView): void => {
    ref.current = next;
    setView(next);
  }, []);

  const refresh = useCallback(async (keepIndex: number): Promise<void> => {
    const summaries = await actionsRef.current.list();
    if (!alive.current) return;
    apply({ summaries, index: clamp(keepIndex, 0, Math.max(0, summaries.length - 1)), mode: { kind: "browse" } });
  }, [apply]);

  // Load once on mount; later list changes come from the shell's own refresh() after a rename/delete.
  // actionsRef keeps this mount load stable even when a parent rebuilds the action object.
  useEffect(() => {
    alive.current = true;
    void refresh(0);
    return () => {
      alive.current = false;
    };

  }, [refresh]);

  useKeyboard((event: KeyEvent) => {
    const current = ref.current;
    const selected = current.summaries[current.index];
    if (current.mode.kind === "renaming") {
      const draft = current.mode.draft;
      if (event.name === "escape") return apply({ ...current, mode: { kind: "browse" } });
      if (event.name === "return") {
        if (selected && !busyRef.current) void actions.rename(selected.id, draft).then(() => refresh(current.index));
        else apply({ ...current, mode: { kind: "browse" } });
        return;
      }
      if (event.name === "backspace") {
        return apply({ ...current, mode: { kind: "renaming", draft: dropLastGrapheme(draft) } });
      }
      const char = printable(event);
      if (char) apply({ ...current, mode: { kind: "renaming", draft: draft + char } });
      return;
    }
    if (current.mode.kind === "deleting") {
      if (event.name === "escape") return apply({ ...current, mode: { kind: "browse" } });
      if (event.name === "return") {
        if (selected && !busyRef.current) void actions.remove(selected.id).then(() => refresh(current.index));
        else apply({ ...current, mode: { kind: "browse" } });
      }
      return;
    }
    // browse
    switch (event.name) {
      case "escape":
        return onClose();
      case "up":
        return apply({ ...current, index: clamp(current.index - 1, 0, Math.max(0, current.summaries.length - 1)) });
      case "down":
        return apply({ ...current, index: clamp(current.index + 1, 0, Math.max(0, current.summaries.length - 1)) });
      case "return":
        if (selected && !busyRef.current) void actions.open(selected.id);
        return;
      case "r":
        if (selected && !busyRef.current) apply({ ...current, mode: { kind: "renaming", draft: selected.displayTitle } });
        return;
      case "d":
        if (selected && !busyRef.current) apply({ ...current, mode: { kind: "deleting" } });
        return;
      case "n":
        if (!busyRef.current) actions.fresh();
        return;
      default:
        return;
    }
  });

  const titleById = new Map(view.summaries.map((s) => [s.id, s.displayTitle] as const));
  const now = Date.now();
  const window = visibleWindow(view.summaries, view.index, Math.max(1, Math.floor((height - 5) / 2)));

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.well}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text>
          <span fg={theme.text}>Kit</span>
          <span fg={theme.rose}>.</span> <span fg={theme.mut}>sessions</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.mut}>
          {String(view.summaries.length)} saved{busy ? " · running" : ""}
        </text>
      </box>
      <box height={1} backgroundColor={theme.edge} />

      <box flexDirection="column" flexGrow={1} paddingTop={1}>
        {view.summaries.length === 0 ? (
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text fg={theme.soft}>no saved sessions yet</text>
            <text fg={theme.mut}>press n to start a new one</text>
          </box>
        ) : (
          window.items.map((summary, slot) => {
            const i = window.start + slot;
            const selected = i === view.index;
            if (selected && view.mode.kind === "renaming") {
              return (
                <box key={summary.id} flexDirection="row" backgroundColor={theme.row} paddingLeft={1} paddingRight={1}>
                  <text fg={theme.rose}>{"> "}</text>
                  <text fg={theme.mut}>rename: </text>
                  <text fg={theme.text}>
                    {view.mode.draft}
                    <span fg={theme.rose}>_</span>
                  </text>
                </box>
              );
            }
            if (selected && view.mode.kind === "deleting") {
              return (
                <box key={summary.id} flexDirection="row" backgroundColor={theme.row} paddingLeft={1} paddingRight={1}>
                  <text fg={theme.rose}>{"> "}</text>
                  <text fg={theme.text}>delete "{summary.displayTitle}"?</text>
                  <box flexGrow={1} />
                  <text fg={theme.mut}>enter deletes · esc cancels</text>
                </box>
              );
            }
            return (
              <SessionCard
                key={summary.id}
                title={summary.displayTitle}
                turnCount={summary.turnCount}
                when={relativeTime(summary.updatedAt, now)}
                selected={selected}
                parentTitle={summary.parent ? titleById.get(summary.parent.id) : undefined}
                parentTurn={summary.parent?.turn}
              />
            );
          })
        )}
      </box>

      <box height={1} backgroundColor={theme.edge} />
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>
          <span fg={theme.soft}>enter</span> resume{"   "}
          <span fg={theme.soft}>r</span> rename{"   "}
          <span fg={theme.soft}>d</span> delete{"   "}
          <span fg={theme.soft}>n</span> new{"   "}
          <span fg={theme.soft}>esc</span> back
        </text>
      </box>
    </box>
  );
}
