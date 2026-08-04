/**
 * Bring a file from a shared folder into the studio, where it can actually be changed.
 *
 * THE OTHER HALF OF THE RULE folder_search states: Kit reads outside and writes inside. This is the
 * only door between the two, and it goes one way. A file in a shared folder is never modified, moved
 * or deleted; it is read, parsed, and proposed as a NEW studio piece. From there the ordinary draft,
 * gate and receipt apply, because what lands is a draft and not a write.
 *
 * WHICH IS WHY THE EFFECT IS "draft" AND NOT "read". The read-only MCP posture drops everything that
 * is not `read`, so this tool is absent from the server the Claude subscription provider spawns, where
 * nothing would ask before applying. It IS present on the standalone server a person registers with
 * their own client, where that client's own permission prompt is the gate. Both are deliberate.
 *
 * NEVER OVERWRITES. An id already on the shelf is refused rather than replaced, since the studio copy
 * is the one somebody has been editing and the outside file is the one they have not. Pass `id` to
 * import the same file again under a different name.
 *
 * BUNDLES COME IN WHOLE, and the reason is measured rather than tidy. A character card carrying an
 * embedded book parses into a character whose body holds `knowledgeRefs` naming that book, so
 * importing the character alone would leave a reference to a piece that is not there. Every piece in
 * the file therefore gets its own draft, each applied and gated separately.
 */
import { z } from "zod";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { ADAPTER_INPUT_MAX_BYTES, registry, toAdapterInput } from "../../core";
import type { AdapterInput, FormatAdapter } from "../../core";
import { ensureFormats } from "../../ensure-formats";
import { inspectBundle, inspectPresetBundle } from "../../convert";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { entityName } from "../../studio/store";
import type { ContentKind } from "../../entities/capabilities";
import { createEntityDraft } from "./_create-common";
import type { HarnessTool, ToolContext, ToolResult } from "./tool";
import { checkGrant, grantFolder, type Grant } from "./_shared/grants";

const input = z.strictObject({
  path: z.string().trim().min(1).max(400)
    .describe("the file to import; must be inside a folder shared with Kit"),
  id: z.string().trim().max(120).optional()
    .describe("studio id for the imported piece; use this when the file's own id is already taken"),
});

const allowed = (studioDir: string, grants?: readonly Grant[]): Grant[] =>
  [grantFolder(studioDir, "studio"), ...(grants ?? [])];

const refuse = (summary: string, output: string): ToolResult =>
  ({ summary, output, outcome: "failed" });

/**
 * Every canonical piece inside one file, primary first.
 *
 * Deliberately the same three-way branch the studio's inspect makes. Shortcutting to `toCanonical`
 * for all kinds would produce a different entity for the same file than the app does, which is the
 * kind of divergence nobody finds until two copies of one card disagree.
 */
function piecesIn(adapter: FormatAdapter, source: AdapterInput): ParsedCanonicalEntity[] {
  if (adapter.kind === "character") {
    const { entity, lorebooks } = inspectBundle(adapter, source);
    return [entity, ...lorebooks];
  }
  if (adapter.kind === "preset") {
    const { entity, regexSets } = inspectPresetBundle(adapter, source);
    return [entity, ...regexSets];
  }
  const entity = parseCanonicalEntity(adapter.toCanonical(source));
  if (entity.kind !== adapter.kind) throw new Error("adapter returned the wrong entity kind");
  return [entity];
}

const folderImport: HarnessTool<z.infer<typeof input>> = {
  name: "folder_import",
  description:
    "Copy a file from a shared folder into the studio so it can be edited. Reads the file, never "
    + "changes it, and proposes the studio pieces as drafts for review. Use this before changing "
    + "anything that lives outside the studio.",
  exposure: "direct",
  // A draft, not a write: nothing reaches the shelf until change_apply runs behind the gate.
  effect: "draft",
  input,
  concurrencyKey: () => "folder-import",
  async execute(args, ctx) {
    if (!ctx.changes) return refuse("folder_import: unavailable", "Importing requires a draft store.");

    const check = checkGrant(allowed(ctx.bridge.studioDir, ctx.grants), args.path);
    if (!check.ok) return refuse(`folder_import: ${check.reason}`, check.detail);

    let info;
    try {
      info = await stat(check.path);
    } catch {
      return refuse("folder_import: not found", `Nothing at ${check.path}.`);
    }
    if (info.isDirectory()) {
      return refuse("folder_import: that is a folder", "Name one file. Use folder_search to list them.");
    }
    if (info.size > ADAPTER_INPUT_MAX_BYTES) {
      return refuse(
        "folder_import: too large",
        `${check.path} is ${info.size} bytes, over the ${ADAPTER_INPUT_MAX_BYTES}-byte ceiling.`,
      );
    }

    // Without this a valid file reads as unrecognised in a packaged binary, where the registry is not
    // populated by globbing source.
    await ensureFormats();
    const source = toAdapterInput(
      new Uint8Array(await Bun.file(check.path).arrayBuffer()),
      basename(check.path),
    );
    const adapter = registry.detect(source);
    if (!adapter) {
      return refuse(
        "folder_import: unrecognised",
        `Hoplight does not recognise ${basename(check.path)} as a character, preset, lorebook, persona or regex set.`,
      );
    }

    let pieces: ParsedCanonicalEntity[];
    try {
      pieces = piecesIn(adapter, source);
    } catch {
      return refuse(
        "folder_import: damaged",
        `${basename(check.path)} looks like a ${adapter.id} file but could not be read safely.`,
      );
    }

    // The primary carries the caller's id override; related pieces keep the ids the primary refers to
    // them by, so renaming one here would break the reference the parse just created.
    const drafted: { kind: string; id: string; draftId: string }[] = [];
    let primary: ToolResult | null = null;
    for (const [index, piece] of pieces.entries()) {
      const result = await createEntityDraft({
        kind: piece.kind as ContentKind,
        id: index === 0 ? (args.id || piece.id) : piece.id,
        name: entityName(piece),
        body: piece.body,
        original: piece.original,
        profiles: (piece as { profiles?: unknown }).profiles,
        input: { path: check.path, from: adapter.id },
        capabilityId: `studio.${piece.kind}.create`,
      }, ctx);
      if (index === 0) primary = result;
      if (result.outcome !== "draft") {
        // A collision on the primary is the caller's to resolve; on a related piece it means the file
        // is partly imported already, and applying the rest would dangle. Either way, stop.
        return {
          ...result,
          summary: index === 0
            ? result.summary
            : `folder_import: ${piece.kind}/${piece.id} already exists`,
          output: index === 0
            ? result.output
            : `${basename(check.path)} also contains ${piece.kind} "${piece.id}", which is already in`
              + ` the studio. Nothing was imported. Rename or delete it first, or pass a different id.`,
        };
      }
      drafted.push({
        kind: piece.kind,
        id: piece.id,
        draftId: (JSON.parse(result.output) as { draftId: string }).draftId,
      });
    }

    const extra = drafted.slice(1);
    return {
      ...primary!,
      summary: `folder_import ${basename(check.path)}: ${drafted.length} draft(s) ready`,
      output: JSON.stringify({
        from: check.path,
        format: adapter.id,
        // Every draft, so a caller applying only the first knows it left pieces behind.
        drafts: drafted,
        note: extra.length === 0
          ? undefined
          : `This file also carried ${extra.length} related piece(s). Apply every draft listed, or the`
            + ` imported ${pieces[0]!.kind} will refer to something the studio does not have.`,
      }),
    };
  },
};

export default folderImport;
