/**
 * The notes capability, built once and declared per kind.
 *
 * WHY A FACTORY. A ContentCapability carries a single `kind` and its id must start with that kind, so
 * "notes on a piece" cannot be one registration covering all six. The behaviour is identical in every
 * case though, and six hand-copied files would drift the moment one of them was edited. Each kind's
 * capabilities folder gets a two-line declaration; the logic lives here.
 *
 * This helper sits OUTSIDE any `capabilities/` directory on purpose: discovery walks for files whose
 * parent folder is named `capabilities`, so a factory placed in one would be registered as a
 * capability itself and fail the catalog's id check.
 *
 * NOTES ARE ON THE ENVELOPE, NOT IN THE BODY, which is what makes this the odd capability out. Every
 * other one previews a new `body`; this one previews new `notes` and leaves the body identical. That
 * is deliberate - see EntityNote in core/canonical.ts for why a note must not be something adapters
 * have to carry, drop or escrow.
 */
import { z } from "zod";
import type { ParsedCanonicalEntity } from "../runtime-schema";
import type { ContentCapability, ContentKind } from "../capabilities";
import type { EntityNote } from "../../core/canonical";
import { addNote, editNote, notesOf, removeNote } from "../../core/notes";

const input = z.strictObject({
  target: z.strictObject({ id: z.string().min(1) }),
  action: z.enum(["add", "edit", "remove"]),
  text: z.string().trim().min(1).max(4_000).optional(),
  noteId: z.string().trim().min(1).max(80).optional(),
  /** Supplied by the caller so a preview is reproducible; the capability never reads a clock. */
  at: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
});

type NoteInput = z.infer<typeof input>;

/** One line per note, so a reviewer reads prose rather than JSON. */
const preview = (notes: readonly EntityNote[]): string =>
  notes.length === 0 ? "(none)" : notes.map((n) => `${n.at.slice(0, 10)}  ${n.text}`).join("\n");

/**
 * A capability is PURE: it previews, it does not decide when "now" is. When the caller omits a stamp
 * a deterministic one is derived from the existing notes, so the same input always previews the same
 * entity and a test can assert on it. A live caller passes the real values.
 */
const stampFor = (entity: ParsedCanonicalEntity, args: NoteInput) => ({
  id: args.id ?? `note-${String(notesOf(entity).length + 1)}`,
  at: args.at ?? "1970-01-01T00:00:00.000Z",
});

export function notesCapability(kind: ContentKind): ContentCapability<NoteInput> {
  return {
    id: `${kind}.notes.write`,
    kind,
    area: "notes",
    action: "write",
    summary: "Keep your own note on this piece, in your own words.",
    aliases: [
      "note",
      "add a note",
      "annotate",
      "remember this about",
      "leave myself a note",
      "why did I do this",
    ],
    platforms: "canonical",
    exposure: "deferred",
    // A capability NEVER writes; it drafts, and change_apply is the only thing that saves. The
    // catalog enforces that, and it caught this file claiming "write" - which the blanket cast below
    // had been happily hiding until the catalog ran.
    effect: "draft",
    input,
    concurrencyKey: (args: NoteInput) => `studio/${kind}/${args.target.id}`,
    preview(entity: ParsedCanonicalEntity, args: NoteInput) {
      const before = notesOf(entity);

      if ((args.action === "add" || args.action === "edit") && !args.text) {
        throw new Error(`${kind}.notes.write: a note needs text to ${args.action}`);
      }
      if ((args.action === "edit" || args.action === "remove") && !args.noteId) {
        throw new Error(`${kind}.notes.write: name the note with noteId to ${args.action} it`);
      }

      const stamp = stampFor(entity, args);
      const next = args.action === "add"
        ? addNote(entity, args.text!, stamp)
        : args.action === "edit"
          ? editNote(entity, args.noteId!, args.text!, stamp.at)
          : removeNote(entity, args.noteId!);

      const after = notesOf(next);
      return {
        entity: next as ParsedCanonicalEntity,
        changes: [{
          path: "/notes",
          label: `${args.action} note`,
          before: preview(before),
          after: preview(after),
        }],
        warnings: [],
        platformImpact: [],
      };
    },
  };
}
