/**
 * The window's end of Kit's command layer: the catalog, the runner, and the argument completer.
 *
 * THE CATALOG IS FETCHED, NEVER WRITTEN DOWN. The server discovers commands by walking folders, and
 * this asks for the result. A command dropped into any `commands/` folder under src/kit appears in
 * this window's popup with nothing edited here - which is the point, and is also how a hand-written
 * list came to be missing four commands the last time somebody tried.
 *
 * A WINDOW WITH NO CATALOG IS A WORKING WINDOW. The fetch can fail; until it answers, `commands` is
 * empty, nothing matches, and a slash line goes to the model as it always did. That is worse than
 * commands working, and much better than a composer that refuses to send.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetchJson } from "../_shared/api-fetch";
import {
  asKitCommands,
  parseCatalog,
  parseEffects,
  parseSuggestions,
  type CommandEffect,
  type CommandInfo,
} from "./command-core";
import type { SlashSeam } from "./use-agent-chat";

/** What the window does with the effects only it can carry out. */
export interface ShellActs {
  /** /model, /providers: open provider setup. */
  openSettings: () => void;
  /** /quit: a browser cannot exit, so the nearest true thing is to close the panel. */
  close: () => void;
  /**
   * `/rail`, and the model's rail_open: put a piece on the Workbench.
   *
   * THE WINDOW'S RAIL. Kit pins a preset's blocks beside the chat; this app already has a surface
   * that shows them and lets you drag them, so the command lands there instead of being withheld.
   */
  openPiece: (piece: { kind: string; id: string }) => void;
}

export interface KitCommands {
  readonly seam: SlashSeam;
  /** Candidates for a command's argument, from the command's own completer. */
  suggest: (line: string) => Promise<{ value: string; note?: string }[]>;
}

export function useKitCommands(acts: ShellActs): KitCommands {
  const [catalog, setCatalog] = useState<readonly CommandInfo[]>([]);

  useEffect(() => {
    let alive = true;
    void apiFetchJson<unknown>("/api/agent/commands")
      .then((body) => { if (alive) setCatalog(parseCatalog(body)); })
      // Silent: the window works without commands, and a red band on load about a feature nobody
      // has reached for yet would be the wrong first thing to say.
      .catch(() => { if (alive) setCatalog([]); });
    return () => { alive = false; };
  }, []);

  const run = useCallback(
    async (
      line: string,
      messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[],
    ): Promise<readonly CommandEffect[]> => {
      const body = await apiFetchJson<unknown>("/api/agent/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line, messages }),
      });
      return parseEffects(body);
    },
    [],
  );

  const suggest = useCallback(async (line: string): Promise<{ value: string; note?: string }[]> => {
    try {
      const body = await apiFetchJson<unknown>("/api/agent/command/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line }),
      });
      return parseSuggestions(body);
    } catch {
      // A keystroke that raced a reload, or a server still starting. No suggestions is a normal
      // answer to "what goes here", and an error band per keypress would be unusable.
      return [];
    }
  }, []);

  const shell = useCallback((effect: CommandEffect): void => {
    if (effect.kind === "settings") { acts.openSettings(); return; }
    if (effect.kind === "open") { acts.openPiece(effect.piece); return; }
    if (effect.kind === "close") acts.close();
  }, [acts]);

  /**
   * Adapted once per catalog, not per keystroke. `matchCommand` runs on every send and the popup
   * filters on every letter; rebuilding twenty-five objects each time would be work done for the
   * garbage collector.
   */
  const commands = useMemo(() => asKitCommands(catalog), [catalog]);
  const seam = useMemo<SlashSeam>(() => ({ commands, catalog, run, shell }), [commands, catalog, run, shell]);

  return { seam, suggest };
}
