/**
 * UI server engine plumbing: inspect/export over the same adapters as the CLI.
 * Extracted from server.ts (behavior-preserving).
 */
import { registry } from "../core";
import type { AdapterInput, CharacterAdapter, FormatAdapter } from "../core";
import { emitBundle, inspectBundle } from "../convert";
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import { filterEnabledBooks } from "../core/lore";
import type { CanonicalEntity } from "../core/canonical";
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

type AnyEntity = CanonicalEntity<string, unknown>;

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
  const filename = req.headers.get("x-filename") ?? "upload";
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
      });
    }
    const entity = adapter.toCanonical(input) as AnyEntity;
    return json({
      ok: true,
      receipt: buildReceipt(entity, adapter.id),
      entity,
      formatId: adapter.id,
      kind: entity.kind,
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
  const b = body as { entity?: AnyEntity; targetId?: string } | null;
  if (!b?.entity || typeof b.targetId !== "string") return err("expected { entity, targetId }");
  const target = registry.get(b.targetId);
  if (!target) return err(`unknown format "${b.targetId}"`);
  if (b.entity.kind !== target.kind) {
    return err(`cannot write a ${b.entity.kind} as ${target.id} (a ${target.kind} format)`);
  }
  try {
    let out: { bytes?: Uint8Array; text?: string; suggestedExtension: string };
    if (target.kind === "character" && b.entity.kind === "character") {
      const resolved = await resolveLorebooksFromStore(store, b.entity);
      if (!resolved.ok) {
        return err(
          `missing lorebook refs: ${resolved.missing.join(", ")}`,
          422,
        );
      }
      out = emitBundle(target as CharacterAdapter, b.entity as CanonicalCharacter, resolved.lorebooks);
    } else {
      out = (target.fromCanonical as (e: AnyEntity) => {
        bytes?: Uint8Array;
        text?: string;
        suggestedExtension: string;
      })(b.entity);
    }
    return json({
      suggestedExtension: out.suggestedExtension,
      text: out.text,
      bytesB64: out.bytes ? Buffer.from(out.bytes).toString("base64") : undefined,
    });
  } catch (e) {
    return err(`${target.id}: ${e instanceof Error ? e.message : String(e)}`, 422);
  }
}
