/**
 * The "New <kind>" button on an empty deck's ghost shelf. ONE data-driven control replacing four
 * near-identical per-kind JSX blocks in index.tsx (the file-size guard forced the extraction, and
 * the duplication was a bug regardless). A kind with no blank-create path renders nothing
 * (packs are imported, not created empty here). `compact` renders the crumb-row variant so
 * POPULATED decks keep a create door too - create used to exist only on empty shelves.
 */
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { createAndOpenCharacter } from "./new-character";
import { createAndOpenLorebook } from "./new-lorebook";
import { createAndOpenRegexSet } from "./new-regex-set";
import { createAndOpenPersona } from "./new-persona";
import { createAndOpenPreset } from "./new-preset";

interface NewSpec {
  label: string;
  /** status-line word ("regex set", "preset"...) */
  word: string;
  create: (ctx: AppContext) => Promise<StudioEntitySummary>;
}

const NEW_BY_KIND: Record<string, NewSpec> = {
  character: { label: "New character", word: "character", create: createAndOpenCharacter },
  lorebook: { label: "New lorebook", word: "lorebook", create: createAndOpenLorebook },
  regex: { label: "New regex set", word: "regex set", create: createAndOpenRegexSet },
  persona: { label: "New persona", word: "persona", create: createAndOpenPersona },
  preset: { label: "New preset", word: "preset", create: createAndOpenPreset },
};

export interface NewInDeckButtonProps {
  kind: string;
  ctx: AppContext;
  /** append the freshly created summary to the deck (parent dedupes by kind+id). */
  onCreated: (summary: StudioEntitySummary) => void;
  /** crumb-row variant for populated decks (the full stamp lives on the empty ghost shelf) */
  compact?: boolean;
}

export function NewInDeckButton({ kind, ctx, onCreated, compact = false }: NewInDeckButtonProps): JSX.Element | null {
  const spec = NEW_BY_KIND[kind];
  if (!spec) return null;
  const create = (): void => {
    void (async () => {
      try {
        const summary = await spec.create(ctx);
        onCreated(summary);
        ctx.workbench.open(summary);
        ctx.setStatus(`opened ${spec.word} · ${summary.name}`);
      } catch (err) {
        ctx.setStatus(err instanceof Error ? err.message : `could not create the ${spec.word}`);
      }
    })();
  };
  if (compact) {
    return (
      <button type="button" className="crumbsel" onClick={create}>
        + {spec.label}
      </button>
    );
  }
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button type="button" className="send" onClick={create}>
        {spec.label}
      </button>
    </div>
  );
}
