/** @jsxImportSource @opentui/react */
/**
 * The screens that REPLACE the conversation rather than sit beside it.
 *
 * Settings, the session playbill, help and tools each take the whole terminal, so they are one
 * concept: a view that is not the session. Returning null means the session should draw instead,
 * which keeps the shell's render a single early-out rather than four.
 */
import type { ReactNode } from "react";
import type { EntitySummary } from "../bridge";
import type { KitCommand } from "../commands/command";
import { HelpScreen } from "./primitives/nav/help-screen";
import { SettingsScreen } from "./settings/settings-screen";
import { ToolsScreen } from "./tools/tools-screen";
import { ResumePlaybill } from "../sessions/render/resume-playbill";
import type { SessionActions } from "../sessions/session-actions";

export type ShellView = "session" | "settings" | "sessions" | "help" | "tools";

export interface FullScreenProps {
  view: ShellView;
  studioName: string;
  commands: KitCommand[];
  pieces: readonly EntitySummary[];
  capabilities: Parameters<typeof ToolsScreen>[0]["capabilities"];
  sessionActions: SessionActions;
  busy: boolean;
  close: () => void;
  onProviderChanged: () => void;
  onProviderSaved: (name: string) => void;
}

/** The full-terminal screen for this view, or null when the session should draw. */
export function FullScreen(props: FullScreenProps): ReactNode {
  const { view, studioName, close } = props;
  if (view === "settings") {
    return (
      <SettingsScreen
        studioName={studioName}
        onClose={close}
        onChanged={props.onProviderChanged}
        onSaved={(config) => props.onProviderSaved(config.name ?? config.kind)}
      />
    );
  }
  if (view === "sessions") {
    return <ResumePlaybill actions={props.sessionActions} busy={props.busy} onClose={close} />;
  }
  if (view === "help") {
    return <HelpScreen commands={props.commands} studioName={studioName} onClose={close} />;
  }
  if (view === "tools") {
    return (
      <ToolsScreen
        pieces={props.pieces}
        capabilities={props.capabilities}
        studioName={studioName}
        onClose={close}
      />
    );
  }
  return null;
}
