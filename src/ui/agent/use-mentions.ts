/**
 * Pointing the agent at a piece from the composer.
 *
 * KIT'S OWN MATCHER, imported rather than rewritten - the same rule as matchCommand. Typing `@bas`
 * offers your pieces; picking one writes the stable marker `@character:basil-1`, which is what the
 * transcript and the model both read. A second implementation here would drift from the terminal's
 * the first time either side learned a new way to match, and the two would disagree about what a
 * given `@` meant.
 *
 * WHY IT IS WORTH HAVING AT ALL. The agent already has studio_read and studio_search, so it could
 * always find a piece - if it knew what to look for. This is the half that was missing: a way to
 * SAY WHICH ONE, out of 164, without typing an id from memory. The marker is unambiguous, so the
 * model reads exactly the piece meant rather than the nearest name match.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyMention,
  matchingPieces,
  mentionDraft,
} from "../../kit/render/primitives/composer/mention-menu-core";
import type { EntitySummary } from "../../kit/bridge";
import { COLLECTION_KIND } from "../../studio/collections-shape";
import { useStudioChanges } from "./use-studio-changes";
import type { AppContext, StudioEntitySummary } from "../app-contract";

/** A row in the picker. `note` is always the piece name, so it matches the slash menu shape. */
export interface MentionChoice {
  readonly value: string;
  readonly note: string;
}

export interface MentionUi {
  /** Rows to draw, empty when the popup should be closed. */
  readonly choices: readonly MentionChoice[];
  readonly active: number;
  readonly title: string;
  /** Insert the chosen piece's marker into the draft. */
  pick: (index: number) => void;
  /** Returns true when the key was the menu's; the composer must then not act on it. */
  onKey: (event: { key: string; preventDefault: () => void }) => boolean;
}

export function useMentions(
  draft: string,
  setDraft: (next: string) => void,
  ctx: AppContext,
): MentionUi {
  const [pieces, setPieces] = useState<readonly StudioEntitySummary[]>([]);
  const [active, setActive] = useState(0);
  /** Escape closes without touching the draft; typing anything opens it again. */
  const [dismissed, setDismissed] = useState("");

  /**
   * Loaded once when the panel mounts rather than per keystroke. A studio is 169 pieces here and the
   * list is only names and ids; re-fetching it on every character typed would put a request behind
   * each letter of a name somebody is halfway through.
   *
   * COLLECTIONS RIDE THE SAME LIST, as rows whose kind is "collection". That is the whole of the
   * feature on this side: `@collection:the-cast` falls out of the grammar Kit already has, because
   * the matcher and the marker builder both work in terms of a kind and an id. Teaching the core a
   * second kind of mention would have been a second grammar to keep in step with the terminal's.
   */
  /**
   * RE-READ WHEN THE FOLDER CHANGES. Loaded once on mount, this list went stale the moment somebody
   * dropped a file into their studio: the piece was on disk, the Library could see it, and `@` could
   * not - so the one way to point the agent at the thing you had just added was the one way that
   * did not work. The watcher already streams these changes; this listens to the same one.
   */
  const { version } = useStudioChanges();

  useEffect(() => {
    let alive = true;
    void Promise.all([
      ctx.api.listEntities(),
      // A studio with no groupings is the common case and must not cost the picker its pieces.
      ctx.api.collections().then((file) => file.collections).catch(() => []),
    ])
      .then(([all, groupings]) => {
        if (!alive) return;
        setPieces([
          // Groupings first: there are a handful against a hundred and sixty-nine pieces, and a
          // collection is the more specific thing to have meant when its name matches.
          ...groupings.map((c) => ({ kind: COLLECTION_KIND, id: c.id, name: c.name })),
          ...all,
        ]);
      })
      .catch(() => { /* no list means no picker, which is a quiet degradation rather than an error */ });
    return () => { alive = false; };
  }, [ctx, version]);

  const query = mentionDraft(draft);
  const open = query !== "" && query !== dismissed;

  const matches = useMemo(
    () => (open ? matchingPieces(pieces as unknown as EntitySummary[], query) : []),
    [open, pieces, query],
  );

  useEffect(() => { setActive(0); }, [query]);

  const pick = useCallback((index: number) => {
    const piece = matches[index];
    if (!piece) return;
    setDraft(applyMention(draft, piece));
    setDismissed("");
  }, [draft, matches, setDraft]);

  const onKey = useCallback((event: { key: string; preventDefault: () => void }): boolean => {
    if (matches.length === 0) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((n) => (n + 1) % matches.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((n) => (n - 1 + matches.length) % matches.length);
      return true;
    }
    /**
     * ENTER AND TAB BOTH COMMIT, and Enter must be claimed here or it sends the half-typed `@bas`
     * as a question. That is the whole reason this returns a boolean rather than handling the key
     * quietly: the composer has to know the menu took it.
     */
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(active);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(query);
      return true;
    }
    return false;
  }, [active, matches.length, pick, query]);

  return {
    choices: matches.map((piece) => ({
      value: `@${piece.kind}:${piece.id}`,
      note: piece.name,
    })),
    active,
    title: "Pieces",
    pick,
    onKey,
  };
}
