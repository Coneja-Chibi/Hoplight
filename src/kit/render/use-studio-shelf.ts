/**
 * What the studio holds right now, kept live by the watcher, plus the argument completion that reads
 * from it.
 *
 * One concept with one source: the shelf. The deck counts and the total are PROJECTIONS of the same
 * list rather than three things kept in step by hand, which is what stops a rename showing in one
 * place and not the other.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckCount, EntitySummary } from "../bridge";
import type { ArgSuggestion, CompletionContext, KitCommand } from "../commands/command";
import { watchSummary } from "../watch/watch-core";
import type { StudioWatchSource } from "../watch/watcher";

export interface StudioShelfDeps {
  pieces: readonly EntitySummary[];
  decks: DeckCount[];
  totalPieces: number;
  watchStudio?: StudioWatchSource;
  /** The folder seam completion offers, handed through untouched. */
  folders: CompletionContext["folders"];
  /** Say something in the transcript when the studio changed under us. */
  onChangeNotice: (text: string) => void;
}

export interface StudioShelf {
  pieces: readonly EntitySummary[];
  decks: DeckCount[];
  total: number;
  /** How many watcher notices have landed; the notify plan uses this as its nudge counter. */
  notices: number;
  completeArg: (command: KitCommand, prefix: string) => Promise<readonly ArgSuggestion[]>;
}

export function useStudioShelf(deps: StudioShelfDeps): StudioShelf {
  const [pieces, setPieces] = useState<readonly EntitySummary[]>(deps.pieces);
  const [decks, setDecks] = useState<DeckCount[]>(deps.decks);
  const [total, setTotal] = useState(deps.totalPieces);
  const [notices, setNotices] = useState(0);

  /**
   * The notice callback rides a REF so the subscription depends only on the watcher.
   *
   * The shell rebuilds its line-adder every render. Depending on it directly would tear down and
   * re-establish the studio watch on every keystroke, which is both wasteful and a way to miss a
   * change that lands in the gap.
   */
  const notice = useRef(deps.onChangeNotice);
  notice.current = deps.onChangeNotice;


  const { watchStudio } = deps;
  useEffect(() => {
    if (!watchStudio) return;
    return watchStudio((change) => {
      setPieces(change.after);
      setTotal(change.after.length);
      setDecks((current) =>
        current.map((deck) => ({
          ...deck,
          count: change.after.filter((piece) => piece.kind === deck.kind).length,
        })),
      );
      notice.current(watchSummary(change));
      setNotices((count) => count + 1);

    });
  }, [watchStudio]);

  /**
   * Argument completion for the slash popup.
   *
   * Reads the shelf the shell already holds rather than the studio, because completion fires while
   * somebody is mid-word and a disk read per keystroke is the wrong shape of cost. A completer that
   * throws costs suggestions, never the command.
   */
  const folders = deps.folders;
  const completeArg = useCallback(
    async (command: KitCommand, prefix: string): Promise<readonly ArgSuggestion[]> => {
      if (!command.complete) return [];
      return command.complete(prefix, {
        pieces: async (kind: string) =>
          pieces.filter((p) => p.kind === kind).map((p) => ({ id: p.id, name: p.name })),
        folders,
      });
    },
    [pieces, folders],
  );

  return { pieces, decks, total, notices, completeArg };
}
