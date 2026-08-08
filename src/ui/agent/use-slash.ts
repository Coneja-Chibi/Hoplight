/**
 * The composer's half of the slash popup: what is open, what is highlighted, and which keys are its.
 *
 * A HOOK RATHER THAN LOGIC IN THE ROOM, because this is the one part of the composer with real
 * state - a stage, a highlight, an in-flight request for argument candidates - and the room is a
 * layout. It is also the part with a rule the room must obey: while the popup is open, Enter and Tab
 * belong to it, and a composer that sends anyway turns a half-typed command word into a question for
 * the model.
 *
 * The decisions about WHAT to show live in slash-core.ts, pure and tested. This is the wiring: when
 * to ask the server for candidates, and what a keypress does.
 */
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { CommandInfo } from "./command-core";
import {
  argStageChoices,
  draftForArg,
  draftForPick,
  exactCommand,
  nextIndex,
  slashQuery,
  wordStageChoices,
} from "./slash-core";
import { commandChoices, type SlashChoice } from "./slash-menu";

export interface SlashUi {
  readonly title: string;
  readonly choices: readonly SlashChoice[];
  readonly active: number;
  pick: (index: number) => void;
  /** True when the popup consumed the key and the composer must not act on it. */
  onKey: (event: KeyboardEvent) => boolean;
}

export function useSlash(
  draft: string,
  setDraft: (next: string) => void,
  catalog: readonly CommandInfo[],
  suggest: (line: string) => Promise<{ value: string; note?: string }[]>,
): SlashUi {
  const [active, setActive] = useState(0);
  /** Escape closes the popup without touching the draft; typing anything opens it again. */
  const [dismissed, setDismissed] = useState("");
  const [args, setArgs] = useState<{ line: string; choices: SlashChoice[] }>({ line: "", choices: [] });

  const query = slashQuery(draft);
  const exact = query ? exactCommand(catalog, query.word) : undefined;
  /** The argument stage: a command has been committed to with a space, and it offers candidates. */
  const argLine = query && query.arg !== null && exact?.completes ? `${query.word} ${query.arg}` : null;

  useEffect(() => {
    if (argLine === null) { setArgs({ line: "", choices: [] }); return; }
    let alive = true;
    void suggest(argLine).then((found) => {
      if (!alive) return;
      setArgs({ line: argLine, choices: found.map((one) => ({ value: one.value, note: one.note ?? "" })) });
    });
    // The answer to an older prefix must not land on a newer one: a fast typist outruns the
    // round trip, and a stale list is worse than no list because it looks current.
    return () => { alive = false; };
  }, [argLine, suggest]);

  const choices = useMemo<SlashChoice[]>(() => {
    if (!query || dismissed === draft) return [];
    if (query.arg === null) return commandChoices(wordStageChoices(catalog, query.word));
    // Only the candidates fetched for THIS prefix. While a request is in flight the list is empty
    // rather than the previous prefix's answer.
    return args.line === argLine ? argStageChoices(args.choices, query.arg) : [];
  }, [query, dismissed, draft, catalog, args, argLine]);

  // A changed draft is a changed question: the highlight goes back to the top rather than staying
  // on whatever row happens to be at that index in a different list.
  useEffect(() => { setActive(0); }, [draft]);

  const pick = useCallback((index: number) => {
    const chosen = choices[index];
    if (!chosen || !query) return;
    if (query.arg !== null) { setDraft(draftForArg(query.word, chosen.value)); return; }
    // The rows in the command stage came out of the catalog, so this find is a lookup rather than a
    // search; the fallback is what a list built from a catalog that changed underneath would need.
    const info = catalog.find((one) => one.name === chosen.value);
    setDraft(info ? draftForPick(info) : chosen.value);
  }, [choices, query, catalog, setDraft]);

  const onKey = useCallback((event: KeyboardEvent): boolean => {
    if (event.key === "Escape" && choices.length > 0) {
      event.preventDefault();
      setDismissed(draft);
      return true;
    }
    if (choices.length === 0) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => nextIndex(at, choices.length, event.key === "ArrowDown" ? 1 : -1));
      return true;
    }
    /**
     * TAB AND ENTER BOTH COMPLETE, and Enter does NOT also send. Completing and sending on one press
     * is how somebody ends up asking the model "/gates" as a question: the popup was open, they meant
     * to take the highlighted row, and the composer took the keystroke first.
     */
    if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
      event.preventDefault();
      pick(active);
      return true;
    }
    return false;
  }, [choices, draft, active, pick]);

  return {
    title: query?.arg === null ? "commands" : "arguments",
    choices,
    active,
    pick,
    onKey,
  };
}
