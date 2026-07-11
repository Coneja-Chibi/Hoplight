/**
 * Binder right-hand host: Health / Changes / Rehearsal panes or the default rail.
 */
import type { JSX } from "react";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import type { LoreFinding, LoreHealthNote } from "../../../../core/lore";
import {
  addKeywordToEntry,
  applyBookTransform,
  restoreEntry,
  revertField,
  selectEntry,
  updateEntry,
  type LoreSession,
} from "./session";
import { HealthPane } from "./health-pane";
import { ChangesPane } from "./changes-pane";
import { RehearsalPane } from "./rehearsal-pane";
import { LoreEntryRail } from "./entry-rail";

export type BinderSidePane = "health" | "changes" | "rehearsal" | null;

export interface BinderSideProps {
  sidePane: BinderSidePane;
  setSidePane: (p: BinderSidePane) => void;
  body: LorebookBody;
  baseline: LorebookBody;
  entry: LorebookEntry | null;
  notes: readonly LoreHealthNote[];
  styles: Readonly<Record<string, string>>;
  setSession: (fn: (s: LoreSession) => LoreSession) => void;
  extraFindings?: readonly LoreFinding[];
}

export function BinderSide({
  sidePane,
  setSidePane,
  body,
  baseline,
  entry,
  notes,
  styles,
  setSession,
  extraFindings,
}: BinderSideProps): JSX.Element | null {
  if (sidePane === "health") {
    return (
      <HealthPane
        body={body}
        onTransform={(fn) => setSession((s) => applyBookTransform(s, fn))}
        onJumpEntry={(id) => setSession((s) => selectEntry(s, id))}
        onClose={() => setSidePane(null)}
        extraFindings={extraFindings}
      />
    );
  }
  if (sidePane === "changes") {
    return (
      <ChangesPane
        baseline={baseline}
        body={body}
        onRevertField={(entryId, field, value) =>
          setSession((s) => revertField(s, entryId, field, value))
        }
        onRestoreEntry={(e: LorebookEntry) => setSession((s) => restoreEntry(s, e))}
        onUndoSwap={(aId, bId) => {
          setSession((s) => {
            const a = s.body.entries.find((x) => x.id === aId);
            const b = s.body.entries.find((x) => x.id === bId);
            if (!a || !b) return s;
            let next = updateEntry(s, aId, { sortOrder: b.sortOrder });
            next = updateEntry(next, bId, { sortOrder: a.sortOrder });
            return next;
          });
        }}
        onJumpEntry={(id) => setSession((s) => selectEntry(s, id))}
        onClose={() => setSidePane(null)}
      />
    );
  }
  if (sidePane === "rehearsal") {
    return (
      <RehearsalPane
        body={body}
        onClose={() => setSidePane(null)}
        onJumpEntry={(id) => setSession((s) => selectEntry(s, id))}
        onAddKeyword={(entryId, keyword) =>
          setSession((s) => addKeywordToEntry(s, entryId, keyword))
        }
      />
    );
  }
  if (!entry) return null;
  return (
    <LoreEntryRail
      entries={body.entries}
      notes={notes}
      styles={styles}
      onOpenHealth={() => setSidePane("health")}
      onOpenChanges={() => setSidePane("changes")}
      onOpenRehearsal={() => setSidePane("rehearsal")}
    />
  );
}
