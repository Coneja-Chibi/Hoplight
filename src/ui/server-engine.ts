/**
 * UI server engine plumbing: inspect/export over the same adapters as the CLI.
 * Extracted from server.ts (behavior-preserving).
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildParseReport, buildSerializeReport, primaryOriginalId, registry, toAdapterInput } from "../core";
import type { AdapterOutput, CharacterAdapter, FormatAdapter } from "../core";
import { isArchiveLimitError } from "../core/archive";
import { isArchiveFormatError } from "../core/archive-stream";
import { emitBundle, inspectBundle, inspectPresetBundle } from "../convert";
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import { filterEnabledBooks } from "../core/lore";
import { parseCanonicalEntity, safeParseCanonicalEntity, type ParsedCanonicalEntity } from "../entities/runtime-schema";
import {
  importLumiverseArchive,
  LVBAK_ARCHIVE_BOUNDS,
  LVBAK_SCHEMA_VERSION,
  LvbakSchemaError,
} from "../formats/lumiverse-archive";
import { zipEntrySourceFromFile } from "../formats/lumiverse-archive/zip-source";
import { stageArchiveEntities } from "./server-staging";
import type { StudioStoreLike } from "../studio/contracts";
import { isStudioReadError } from "../studio/errors";
import type { InspectArchiveResult, InspectResult } from "./app-contract";
import { buildReceipt, friendlyFormat, UNKNOWN_FILE_MESSAGE, unsupportedShapeLine } from "./receipt";
import {
  contentTypeIs,
  err,
  json,
  readBodyCapped,
  streamBodyToFile,
  INSPECT_BODY_MAX,
} from "./server-security";

type AnyEntity = ParsedCanonicalEntity;

export const formatMeta = (a: FormatAdapter): Record<string, unknown> => ({
  id: a.id,
  label: a.label,
  kind: a.kind,
  outputExtensions: a.outputExtensions,
  friendly: friendlyFormat(a.id),
  native: a.native ?? false,
  generic: a.generic ?? false,
});

export async function handleInspect(req: Request): Promise<Response> {
  if (!contentTypeIs(req, "application/octet-stream")) {
    return err("unsupported media type", 415);
  }
  const rawFilename = req.headers.get("x-filename") ?? "upload";
  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename); // the client always encodes (headers are Latin-1)
  } catch {
    filename = rawFilename; // older client or hand-rolled request: use it as sent
  }
  const capped = await readBodyCapped(req, INSPECT_BODY_MAX);
  if (!capped.ok) return capped.response;
  const bytes = capped.bytes;
  if (bytes.length === 0) return err("empty upload");
  const input = toAdapterInput(bytes, filename);
  const adapter = registry.detect(input);
  if (!adapter) {
    // a shape we KNOW but refuse (preset/template firewall) gets named; strangers get the generic line
    return json({ ok: false, error: unsupportedShapeLine(input.text) ?? UNKNOWN_FILE_MESSAGE }, 200);
  }
  try {
    if (adapter.kind === "character") {
      const { entity, lorebooks } = inspectBundle(adapter, input);
      return json({
        ok: true,
        receipt: buildReceipt(entity, adapter.id, lorebooks),
        entity,
        related: lorebooks.length > 0 ? { lorebooks } : undefined,
        formatId: adapter.id,
        kind: entity.kind,
        parseReport: buildParseReport(entity, adapter.id),
      });
    }
    if (adapter.kind === "preset") {
      const { entity, regexSets } = inspectPresetBundle(adapter, input);
      return json({
        ok: true,
        receipt: buildReceipt(entity, adapter.id, undefined, regexSets),
        entity,
        related: regexSets.length > 0 ? { regexSets } : undefined,
        formatId: adapter.id,
        kind: entity.kind,
        parseReport: buildParseReport(entity, adapter.id),
      });
    }
    const entity = parseCanonicalEntity(adapter.toCanonical(input));
    if (entity.kind !== adapter.kind) throw new Error("adapter returned the wrong entity kind");
    return json({
      ok: true,
      receipt: buildReceipt(entity, adapter.id),
      entity,
      formatId: adapter.id,
      kind: entity.kind,
      parseReport: buildParseReport(entity, adapter.id),
    });
  } catch {
    return json(
      { ok: false, error: `This looks like a ${friendlyFormat(adapter.id)} file, but it is damaged and we could not read it safely.` },
      200,
    );
  }
}

// One archive inspect at a time, server-side. Each request can stage up to
// LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes (5 GiB) of temp file - the same disk-fill concern that
// already makes this route loopback-only (server.ts's isLoopbackOnlyRoute) applies just as much to
// the surface that DOES accept it. Safe as a bare module-level flag: Bun's single-threaded event
// loop means the check-then-set below never races across two concurrent requests. The client's own
// ARCHIVE_POOL=1 (import-flow.tsx) already serializes uploads from one sheet, so this changes
// nothing for the normal path - it only refuses a genuinely overlapping second request.
let archiveInspectInFlight = false;

/**
 * Handle a `.lvbak` upload (spec: specs/formats/lumiverse-archive.md). Deliberately its OWN route,
 * never `/api/inspect`: that endpoint buffers the whole body into one Uint8Array and caps it at
 * ADAPTER_INPUT_MAX_BYTES (64 MiB) - fine for a single card, hopeless for a Lumiverse backup, which
 * is multi-gigabyte by design and whose real ceiling is LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes (5
 * GiB). The upload streams straight to a throwaway OS-temp file (never held in memory at once,
 * same discipline the fixture materializer already uses for the same format), and
 * zipEntrySourceFromFile reads it back with bounded random access. The temp file is removed
 * whether the import succeeds or fails - it has no purpose past this one request.
 *
 * `.lvbak` registers no adapter on purpose (index.ts's own barrel comment), so this never touches
 * registry.detect: the detection race that decides every OTHER upload's format must never see an
 * archive, or a hostile .lvbak could get mis-claimed by some other adapter's sniffing.
 */
export async function handleInspectArchive(req: Request): Promise<Response> {
  if (!contentTypeIs(req, "application/octet-stream")) {
    return err("unsupported media type", 415);
  }
  const rawFilename = req.headers.get("x-filename") ?? "upload.lvbak";
  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename);
  } catch {
    filename = rawFilename;
  }
  if (!filename.toLowerCase().endsWith(".lvbak")) {
    return err("expected a .lvbak file", 400);
  }
  if (archiveInspectInFlight) {
    return err("Another backup is still being read - try again when it finishes.", 429);
  }
  archiveInspectInFlight = true;

  const dir = await mkdtemp(join(tmpdir(), "hoplight-lvbak-upload-"));
  const tempPath = join(dir, "upload.lvbak");
  let source: Awaited<ReturnType<typeof zipEntrySourceFromFile>> | undefined;
  try {
    const staged = await streamBodyToFile(req, tempPath, LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes);
    if (!staged.ok) return staged.response;
    if (staged.bytes === 0) return err("empty upload");

    source = zipEntrySourceFromFile(tempPath, LVBAK_ARCHIVE_BOUNDS);
    const { entities, report } = await importLumiverseArchive(source);
    // Rows are SUMMARIES: the entities go to disk-side staging, never into this response. A real
    // backup's entities total gigabytes; embedding them is exactly what OOM'd the old design
    // (JSON.stringify caps near 2 GiB). Commit fetches each row back via /api/studio/save-staged.
    const stagedRefs = await stageArchiveEntities(entities);
    const rows: InspectResult[] = entities.map((entity, i) => {
      const sourceId = primaryOriginalId(entity.original) ?? "lumiverse-archive";
      const ref = stagedRefs[i]!;
      // The sheet's link caveat and entry-count chip used to read these off the entity; summary
      // rows must carry them explicitly or those features go silently dead on archive rows.
      const body = entity.body as { knowledgeRefs?: unknown; entries?: unknown };
      const knowledgeRefs = Array.isArray(body.knowledgeRefs)
        ? body.knowledgeRefs.filter((r): r is string => typeof r === "string")
        : undefined;
      const entryCount =
        entity.kind === "lorebook" && Array.isArray(body.entries) ? body.entries.length : undefined;
      return {
        ok: true,
        receipt: buildReceipt(entity, "lumiverse-archive"),
        staged: { token: ref.token, key: ref.key },
        entityId: ref.entityId,
        contentHash: ref.contentHash,
        ...(knowledgeRefs && knowledgeRefs.length > 0 ? { knowledgeRefs } : {}),
        ...(entryCount !== undefined ? { entryCount } : {}),
        formatId: "lumiverse-archive",
        kind: entity.kind,
        parseReport: buildParseReport(entity, sourceId),
      };
    });
    const result: InspectArchiveResult = { ok: true, rows, report };
    return json(result);
  } catch (error) {
    const result: InspectArchiveResult = { ok: false, error: archiveErrorMessage(error) };
    return json(result, 200);
  } finally {
    await source?.close();
    await rm(dir, { recursive: true, force: true });
    archiveInspectInFlight = false;
  }
}

/** Warm, plain-words line for a whole-archive abort - never the technical exception text. */
export function archiveErrorMessage(error: unknown): string {
  if (error instanceof LvbakSchemaError) {
    return (
      `This backup was made by a newer version of Lumiverse (schema ${error.schemaVersion}) than ` +
      `this build of Hoplight understands (schema ${LVBAK_SCHEMA_VERSION}). Update Hoplight and try again.`
    );
  }
  if (isArchiveLimitError(error)) {
    return "This archive is larger or more complex than Hoplight can safely read right now.";
  }
  if (isArchiveFormatError(error)) {
    return "This archive's container looks damaged or is not a valid ZIP; we could not read it safely.";
  }
  // The importer prefixes every deliberate rejection with "lumiverse-archive:" (no manifest, no
  // database/ tree, an unreadable required entry) - for those, "not a backup" is the truth.
  if (error instanceof Error && error.message.startsWith("lumiverse-archive:")) {
    return "We could not read this one. It does not look like a Lumiverse backup archive (.lvbak).";
  }
  // Anything else is OUR failure, not the backup's. Blaming the file here sent a real user
  // chasing a corrupt-backup theory when the actual fault was a response-size crash server-side.
  console.error("[inspect-archive] unexpected failure:", error);
  return "Something went wrong on Hoplight's side while reading this backup. The details were logged; the backup itself is probably fine.";
}

/**
 * Resolve knowledgeRefs as lorebook entities from the studio store. Missing, wrong-kind, or
 * unreadable refs fail closed with the missing ids (no lossy export).
 */
async function resolveLorebooksFromStore(
  store: StudioStoreLike,
  entity: AnyEntity,
): Promise<{ ok: true; lorebooks: CanonicalLorebook[] } | { ok: false; missing: string[] }> {
  if (entity.kind !== "character") return { ok: true, lorebooks: [] };
  const body = entity.body as { knowledgeRefs?: unknown };
  const refs = Array.isArray(body.knowledgeRefs)
    ? body.knowledgeRefs.filter((r): r is string => typeof r === "string" && r.length > 0)
    : [];
  if (refs.length === 0) return { ok: true, lorebooks: [] };

  const lorebooks: CanonicalLorebook[] = [];
  const missing: string[] = [];
  for (const id of refs) {
    try {
      const found = await store.read("lorebook", id);
      if (!found || found.kind !== "lorebook") {
        missing.push(id);
        continue;
      }
      lorebooks.push(found as CanonicalLorebook);
    } catch (e) {
      if (isStudioReadError(e)) {
        missing.push(id);
        continue;
      }
      throw e;
    }
  }
  if (missing.length > 0) return { ok: false, missing };
  // Book-level off (shelf switch): skip export embed, not an error.
  return { ok: true, lorebooks: filterEnabledBooks(lorebooks) };
}

export async function handleExport(store: StudioStoreLike, body: unknown): Promise<Response> {
  const b = body as { entity?: unknown; targetId?: unknown; extension?: unknown } | null;
  if (!b?.entity || typeof b.targetId !== "string") return err("expected { entity, targetId }");
  const parsed = safeParseCanonicalEntity(b.entity);
  if (!parsed.ok) return err(`invalid canonical entity: ${parsed.issues[0] ?? "invalid shape"}`, 400);
  const entity = parsed.entity;
  const target = registry.get(b.targetId);
  if (!target) return err(`unknown format "${b.targetId}"`);
  if (entity.kind !== target.kind) {
    return err(`cannot write a ${entity.kind} as ${target.id} (a ${target.kind} format)`);
  }
  try {
    let out: AdapterOutput;
    if (target.kind === "character" && entity.kind === "character") {
      const resolved = await resolveLorebooksFromStore(store, entity);
      if (!resolved.ok) {
        return err(
          `missing lorebook refs: ${resolved.missing.join(", ")}`,
          422,
        );
      }
      /**
       * THE EXTENSION THE PERSON PICKED, which this route never sent.
       *
       * `emitBundle` has always accepted one and only the CLI ever supplied it - from the output
       * path - so a format offering more than one container could only ever emit its first from the
       * app. PNG was unreachable from the studio entirely: the dialog listed ".json · .png" and
       * every export took the json branch.
       */
      const wanted = typeof b.extension === "string" ? b.extension.toLowerCase() : undefined;
      out = emitBundle(
        target as CharacterAdapter,
        entity as CanonicalCharacter,
        resolved.lorebooks,
        wanted,
      );
    } else {
      out = (target.fromCanonical as (e: AnyEntity) => {
        bytes?: Uint8Array;
        text?: string;
        suggestedExtension: string;
      })(entity);
    }
    const report = out.report ?? buildSerializeReport(entity, target);
    return json({
      suggestedExtension: out.suggestedExtension,
      text: out.text,
      bytesB64: out.bytes ? Buffer.from(out.bytes).toString("base64") : undefined,
      report,
    });
  } catch (e) {
    return err(`${target.id}: ${e instanceof Error ? e.message : String(e)}`, 422);
  }
}
