/**
 * UI server engine plumbing: inspect/export over the same adapters as the CLI.
 * Extracted from server.ts (behavior-preserving).
 */
import { buildParseReport, buildSerializeReport, registry } from "../core";
import type { AdapterInput, AdapterOutput, CharacterAdapter, FormatAdapter } from "../core";
import { emitBundle, inspectBundle } from "../convert";
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import { filterEnabledBooks } from "../core/lore";
import { parseCanonicalEntity, safeParseCanonicalEntity, type ParsedCanonicalEntity } from "../entities/runtime-schema";
import { StudioStore } from "../studio/store";
import { isStudioReadError } from "../studio/errors";
import { buildReceipt, friendlyFormat, UNKNOWN_FILE_MESSAGE } from "./receipt";
import {
  contentTypeIs,
  err,
  json,
  readBodyCapped,
  INSPECT_BODY_MAX,
} from "./server-security";

type AnyEntity = ParsedCanonicalEntity;

function toAdapterInput(bytes: Uint8Array, filename: string): AdapterInput {
  const input: AdapterInput = { bytes, filename };
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "json" || ext === "txt" || ext === "lorebook") {
    try {
      input.text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      /* binary */
    }
  }
  return input;
}

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
  if (!adapter) return json({ ok: false, error: UNKNOWN_FILE_MESSAGE }, 200);
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

/**
 * Resolve knowledgeRefs as lorebook entities from the studio store. Missing, wrong-kind, or
 * unreadable refs fail closed with the missing ids (no lossy export).
 */
async function resolveLorebooksFromStore(
  store: StudioStore,
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

export async function handleExport(store: StudioStore, body: unknown): Promise<Response> {
  const b = body as { entity?: unknown; targetId?: unknown } | null;
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
      out = emitBundle(target as CharacterAdapter, entity as CanonicalCharacter, resolved.lorebooks);
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
