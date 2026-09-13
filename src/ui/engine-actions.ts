/**
 * Runtime-neutral Studio engine actions shared by the loopback server and browser-only build.
 * They own format inspection/export semantics, but know nothing about HTTP or filesystems.
 */
import { characterPngCard, pngCardRefusal } from "../formats/_shared/card-png";
import { buildParseReport, buildSerializeReport } from "../core/reports";
import * as registry from "../core/registry";
import { toAdapterInput } from "../core/adapter-input";
import type { AdapterOutput, CharacterAdapter, FormatAdapter } from "../core/adapter";
import { emitBundle, inspectBundle, inspectPresetBundle } from "../convert";
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import { filterEnabledBooks } from "../core/lore";
import {
  parseCanonicalEntity,
  safeParseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "../entities/runtime-schema";
import type { StudioStoreLike } from "../studio/contracts";
import { isStudioReadError } from "../studio/errors";
import type { ExportResult, InspectResult } from "./app-contract";
import { buildReceipt, friendlyFormat, UNKNOWN_FILE_MESSAGE, unsupportedShapeLine } from "./receipt";

type AnyEntity = ParsedCanonicalEntity;

export class EngineActionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "EngineActionError";
  }
}

export const formatMeta = (adapter: FormatAdapter): Record<string, unknown> => ({
  id: adapter.id,
  label: adapter.label,
  kind: adapter.kind,
  outputExtensions: adapter.outputExtensions,
  friendly: friendlyFormat(adapter.id),
  native: adapter.native ?? false,
  generic: adapter.generic ?? false,
});

export function inspectBytes(bytes: Uint8Array, filename: string): InspectResult {
  if (bytes.length === 0) throw new EngineActionError("empty upload");
  const input = toAdapterInput(bytes, filename);
  const adapter = registry.detect(input);
  if (!adapter) return { ok: false, error: unsupportedShapeLine(input.text) ?? UNKNOWN_FILE_MESSAGE };
  try {
    if (adapter.kind === "character") {
      const { entity, lorebooks } = inspectBundle(adapter, input);
      return {
        ok: true,
        receipt: buildReceipt(entity, adapter.id, lorebooks),
        entity,
        related: lorebooks.length > 0 ? { lorebooks } : undefined,
        formatId: adapter.id,
        kind: entity.kind,
        parseReport: buildParseReport(entity, adapter.id),
      };
    }
    if (adapter.kind === "preset") {
      const { entity, regexSets } = inspectPresetBundle(adapter, input);
      return {
        ok: true,
        receipt: buildReceipt(entity, adapter.id, undefined, regexSets),
        entity,
        related: regexSets.length > 0 ? { regexSets } : undefined,
        formatId: adapter.id,
        kind: entity.kind,
        parseReport: buildParseReport(entity, adapter.id),
      };
    }
    const entity = parseCanonicalEntity(adapter.toCanonical(input));
    if (entity.kind !== adapter.kind) throw new Error("adapter returned the wrong entity kind");
    return {
      ok: true,
      receipt: buildReceipt(entity, adapter.id),
      entity,
      formatId: adapter.id,
      kind: entity.kind,
      parseReport: buildParseReport(entity, adapter.id),
    };
  } catch {
    return {
      ok: false,
      error: `This looks like a ${friendlyFormat(adapter.id)} file, but it is damaged and we could not read it safely.`,
    };
  }
}

async function resolveLorebooks(store: StudioStoreLike, entity: AnyEntity): Promise<CanonicalLorebook[]> {
  if (entity.kind !== "character") return [];
  const refs = Array.isArray((entity.body as { knowledgeRefs?: unknown }).knowledgeRefs)
    ? (entity.body as { knowledgeRefs: unknown[] }).knowledgeRefs
        .filter((ref): ref is string => typeof ref === "string" && ref.length > 0)
    : [];
  const lorebooks: CanonicalLorebook[] = [];
  const missing: string[] = [];
  for (const id of refs) {
    try {
      const found = await store.read("lorebook", id);
      if (!found || found.kind !== "lorebook") missing.push(id);
      else lorebooks.push(found as CanonicalLorebook);
    } catch (error) {
      if (!isStudioReadError(error)) throw error;
      missing.push(id);
    }
  }
  if (missing.length > 0) throw new EngineActionError(`missing lorebook refs: ${missing.join(", ")}`, 422);
  return filterEnabledBooks(lorebooks);
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

export async function exportCanonical(store: StudioStoreLike, body: unknown): Promise<ExportResult> {
  const request = body as { entity?: unknown; targetId?: unknown; extension?: unknown } | null;
  if (!request?.entity || typeof request.targetId !== "string") {
    throw new EngineActionError("expected { entity, targetId }");
  }
  const parsed = safeParseCanonicalEntity(request.entity);
  if (!parsed.ok) {
    throw new EngineActionError(`invalid canonical entity: ${parsed.issues[0] ?? "invalid shape"}`);
  }
  const entity = parsed.entity;
  const target = registry.get(request.targetId);
  if (!target) throw new EngineActionError(`unknown format "${request.targetId}"`);
  if (entity.kind !== target.kind) {
    throw new EngineActionError(`cannot write a ${entity.kind} as ${target.id} (a ${target.kind} format)`);
  }
  try {
    let out: AdapterOutput;
    if (target.kind === "character" && entity.kind === "character") {
      const wanted = typeof request.extension === "string" ? request.extension.toLowerCase() : undefined;
      const character = entity as CanonicalCharacter;
      const writesPng = target.outputExtensions.some((extension) => extension.replace(/^\./, "") === "png");
      if (wanted === "png" && !writesPng) {
        const refusal = pngCardRefusal(character);
        if (refusal) throw new EngineActionError(`${target.id}: ${refusal}`, 422);
        out = {
          bytes: characterPngCard(character),
          suggestedExtension: "png",
          report: buildSerializeReport(entity, target),
        };
      } else {
        out = emitBundle(target as CharacterAdapter, character, await resolveLorebooks(store, entity), wanted);
      }
    } else {
      out = (target.fromCanonical as (value: AnyEntity) => AdapterOutput)(entity);
    }
    return {
      suggestedExtension: out.suggestedExtension,
      text: out.text,
      bytesB64: out.bytes ? bytesToBase64(out.bytes) : undefined,
      report: out.report ?? buildSerializeReport(entity, target),
    };
  } catch (error) {
    if (error instanceof EngineActionError) throw error;
    throw new EngineActionError(`${target.id}: ${error instanceof Error ? error.message : String(error)}`, 422);
  }
}
