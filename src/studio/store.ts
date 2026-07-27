/**
 * The studio store - Hoplight local-first entity storage with path containment and atomic writes.
 */
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../entities/runtime-schema";
import { entityRevision } from "../entities/canonical-revision";
import { StudioConflictError, StudioWriteError } from "./atomic-file";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import {
  StudioNotFoundError,
  StudioReadError,
  StudioValidationError,
  type StudioDamageReason,
} from "./errors";
import {
  assertSafeStudioId,
  assertStudioEntityKind,
  resolveStudioPath,
  STUDIO_ENTITY_KINDS,
  type StudioEntityKind,
} from "./path-policy";
import { hasPortrait, portraitBytes } from "./portrait";
import { signatureFromPng } from "./signature-color";

type AnyEntity = ParsedCanonicalEntity;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface EntitySummary {
  id: string;
  kind: string;
  name: string;
  importedAt?: string;
  hasPortrait?: boolean;
  accent?: string;
  sourceFormat?: string;
  sourceVariant?: string;
}

export interface DamagedEntry {
  kind: string;
  id: string;
  reason: StudioDamageReason;
}

export interface StudioInventory {
  entities: EntitySummary[];
  damaged: DamagedEntry[];
}

export type CompareSaveResult =
  | { status: "saved"; summary: EntitySummary; revision: string }
  | { status: "stale" | "missing" };

export type CompareCreateResult =
  | { status: "saved"; summary: EntitySummary }
  | { status: "exists" };

const HEX6 = /^#[0-9a-f]{6}$/i;

function authoredSignature(entity: AnyEntity): string | undefined {
  const pres = (entity as {
    body?: { presentation?: { signatureColor?: unknown; gradientColors?: unknown } };
  }).body?.presentation;
  const solid = typeof pres?.signatureColor === "string" ? pres.signatureColor : undefined;
  const stops = pres?.gradientColors;
  const first = Array.isArray(stops) && typeof stops[0] === "string" ? stops[0] : undefined;
  const hex = solid || first;
  return hex && HEX6.test(hex) ? hex : undefined;
}

function sourceOf(entity: AnyEntity): { format?: string; variant?: string } {
  for (const [formatId, entry] of Object.entries(entity.original ?? {})) {
    if (formatId === "vaud-studio") continue;
    const variant = entry?.unmapped?.["variant"];
    return { format: formatId, variant: typeof variant === "string" ? variant : undefined };
  }
  return {};
}

function entityName(entity: AnyEntity): string {
  const body = isRecord(entity.body) ? entity.body : undefined;
  if (!body) return entity.id;
  const identity = body.identity as { name?: string } | undefined;
  if (typeof identity?.name === "string" && identity.name) return identity.name;
  if (typeof body.name === "string" && body.name) return body.name;
  return entity.id;
}

/**
 * Bring a stored entity up to the current shape before it is decoded.
 *
 * TOLERATE ON READ, STAY STRICT ON WRITE. This runs only here, at the read-from-disk boundary, and
 * deliberately NOT inside parseCanonicalEntity: that function is also called on the WRITE path by
 * the converters and the capability preview, where a codec emitting the wrong shape is a bug in
 * Hoplight and must still fail. Loosening it there would hide our own defects to be kind to a file.
 *
 * Every rule here answers real data found on disk. A file that only ever loaded on an older build
 * is still the user's work, and refusing it outright is what turned four perfectly readable regex
 * sets into "corrupt entity file" with nothing else to go on.
 */
function migrateStoredEntity(raw: Record<string, unknown>): Record<string, unknown> {
  const { escrow: legacy, ...rest } = raw;
  const out: Record<string, unknown> =
    legacy !== undefined && raw["original"] === undefined ? { ...rest, original: legacy } : rest;

  // schemaVersion has been the STRING "1" since the first commit, but files exist carrying the
  // number 1. Nothing about the entity differs; only the JSON type of one field does.
  if (typeof out["schemaVersion"] === "number") out["schemaVersion"] = String(out["schemaVersion"]);
  return out;
}

/** Name the field that actually failed. "corrupt entity file" alone leaves a user nothing to act on. */
function describeSchemaMismatch(error: unknown): string {
  const issues = (error as { issues?: { path?: unknown[]; message?: string }[] }).issues;
  const first = issues?.[0];
  if (!first) return "corrupt entity file";
  const where = Array.isArray(first.path) && first.path.length > 0 ? first.path.join(".") : "the entity";
  const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
  return `corrupt entity file: ${where} ${first.message ?? "did not match the expected shape"}${more}`;
}

function parseStoredEntity(
  text: string,
  kind: string,
  id: string,
): AnyEntity {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new StudioReadError("corrupt entity file", "unreadable-json");
  }
  if (!isRecord(raw)) throw new StudioReadError("corrupt entity file", "schema-mismatch");
  let parsed: AnyEntity;
  try {
    parsed = parseCanonicalEntity(migrateStoredEntity(raw));
  } catch (error) {
    throw new StudioReadError(describeSchemaMismatch(error), "schema-mismatch");
  }
  if (parsed.kind !== kind) throw new StudioReadError("corrupt entity file", "kind-mismatch");
  if (parsed.id !== id) throw new StudioReadError("corrupt entity file", "id-mismatch");
  return parsed;
}


export class StudioStore {
  // the fs backend is the ONE injection point: node fs on desktop/CLI, OPFS in the pocket build
  constructor(
    private readonly dir: string,
    private readonly io: StudioFs = nodeStudioFs,
  ) {}

  /** Where this studio lives on disk (About shows it; never used for writes outside resolve). */
  studioPath(): string {
    return this.dir;
  }

  /** One filesystem pass for healthy summaries and fail-closed damage records. */
  async inventory(kind?: string): Promise<StudioInventory> {
    const kinds: StudioEntityKind[] = kind
      ? [assertStudioEntityKind(kind)]
      : [...STUDIO_ENTITY_KINDS];
    const entities: EntitySummary[] = [];
    const damaged: DamagedEntry[] = [];
    for (const k of kinds) {
      const kindDir = resolveStudioPath(this.dir, k);
      const files = await this.io.listDir(kindDir);
      if (files === null) continue;
      for (const f of files.filter((n) => n.endsWith(".json")).sort()) {
        const id = f.slice(0, -5);
        try {
          assertSafeStudioId(id);
        } catch {
          continue;
        }
        try {
          const entity = await this.read(k, id);
          if (!entity) continue;
          const studioMeta = entity.original?.["vaud-studio"]?.unmapped;
          const cached = studioMeta?.["accent"];
          const artAccent = typeof cached === "string" && HEX6.test(cached) ? cached : undefined;
          const source = sourceOf(entity);
          entities.push({
            id,
            kind: k,
            name: entityName(entity),
            importedAt: (studioMeta?.["importedAt"] as string) ?? undefined,
            hasPortrait: hasPortrait(entity),
            accent: authoredSignature(entity) ?? artAccent,
            sourceFormat: source.format,
            sourceVariant: source.variant,
          });
        } catch (error) {
          damaged.push({
            kind: k,
            id,
            reason: error instanceof StudioReadError && error.reason
              ? error.reason
              : "unreadable-json",
          });
        }
      }
    }
    return { entities, damaged };
  }

  async list(kind?: string): Promise<EntitySummary[]> {
    return (await this.inventory(kind)).entities;
  }

  async read(kind: string, id: string): Promise<AnyEntity | null> {
    const path = resolveStudioPath(this.dir, kind, id);
    const text = await this.io.readText(path);
    if (text === null) return null;
    return parseStoredEntity(text, kind, id);
  }

  /** Remove one entity file (same containment as read). True when a file was actually removed. */
  async delete(kindRaw: string, idRaw: string): Promise<boolean> {
    const kind = assertStudioEntityKind(kindRaw);
    const id = assertSafeStudioId(idRaw);
    const path = resolveStudioPath(this.dir, kind, id);
    return this.io.remove(path);
  }

  async save(raw: unknown, opts?: { overwrite?: boolean }): Promise<EntitySummary> {
    let entity: AnyEntity;
    try {
      entity = parseCanonicalEntity(raw);
    } catch {
      throw new StudioValidationError("invalid canonical entity");
    }
    const kind = assertStudioEntityKind(entity.kind);
    let id = assertSafeStudioId(entity.id);
    const kindDir = resolveStudioPath(this.dir, kind);
    await this.io.mkdirp(kindDir);

    const now = new Date().toISOString();
    let priorImportedAt: string | undefined;
    let priorUnmapped: Record<string, unknown> = {};

    if (opts?.overwrite) {
      try {
        const existing = await this.read(kind, id);
        if (existing) {
          const um = existing.original?.["vaud-studio"]?.unmapped;
          if (um && typeof um === "object") priorUnmapped = { ...um };
          if (typeof um?.["importedAt"] === "string") priorImportedAt = um["importedAt"] as string;
        }
      } catch {
        /* missing/corrupt on overwrite: still write */
      }
    }

    const priorAccent = priorUnmapped["accent"];
    let accent = typeof priorAccent === "string" ? priorAccent : undefined;
    if (!accent) {
      const art = portraitBytes({ ...entity, id });
      if (art?.mime === "image/png") accent = signatureFromPng(art.bytes) ?? undefined;
    }

    const importedAt = priorImportedAt ?? now;
    const stamped: AnyEntity = {
      ...entity,
      id,
      original: {
        ...(entity.original ?? {}),
        "vaud-studio": {
          raw: entity.original?.["vaud-studio"]?.raw ?? null,
          unmapped: {
            ...priorUnmapped,
            importedAt,
            ...(accent ? { accent } : {}),
            updatedAt: now,
          },
        },
      },
    };

    const filePath = resolveStudioPath(this.dir, kind, id);
    const body = JSON.stringify(stamped, null, 2);
    try {
      if (opts?.overwrite) await this.io.writeAtomicReplace(filePath, body);
      else await this.io.writeExclusive(filePath, body);
    } catch (e) {
      if (e instanceof StudioConflictError && !opts?.overwrite) {
        let n = 2;
        const base = assertSafeStudioId(entity.id);
        for (;;) {
          const candidate = `${base}-${n++}`;
          assertSafeStudioId(candidate);
          const retry: AnyEntity = { ...stamped, id: candidate };
          try {
            await this.io.writeExclusive(
              resolveStudioPath(this.dir, kind, candidate),
              JSON.stringify(retry, null, 2),
            );
            return { id: candidate, kind, name: entityName(retry), importedAt, accent };
          } catch (retryError) {
            if (retryError instanceof StudioConflictError) continue;
            if (retryError instanceof StudioWriteError) throw retryError;
            throw new StudioWriteError();
          }
        }
      }
      if (e instanceof StudioWriteError || e instanceof StudioConflictError) throw e;
      throw new StudioWriteError();
    }

    return { id, kind, name: entityName(stamped), importedAt, accent };
  }

  /**
   * Create one entity at its exact requested id only when absent.
   * The check and publish execute under the backend's per-path write lock.
   */
  async compareAndCreate(raw: unknown): Promise<CompareCreateResult> {
    let entity: AnyEntity;
    try {
      entity = parseCanonicalEntity(raw);
    } catch {
      throw new StudioValidationError("invalid canonical entity");
    }
    const kind = assertStudioEntityKind(entity.kind);
    const id = assertSafeStudioId(entity.id);
    const filePath = resolveStudioPath(this.dir, kind, id);
    const now = new Date().toISOString();
    let outcome: CompareCreateResult = { status: "exists" };

    await this.io.updateAtomic(filePath, (text) => {
      if (text !== null) {
        outcome = { status: "exists" };
        return null;
      }
      let accent: string | undefined;
      const art = portraitBytes(entity);
      if (art?.mime === "image/png") accent = signatureFromPng(art.bytes) ?? undefined;
      const stamped: AnyEntity = {
        ...entity,
        original: {
          ...(entity.original ?? {}),
          "vaud-studio": {
            raw: entity.original?.["vaud-studio"]?.raw ?? null,
            unmapped: {
              importedAt: now,
              ...(accent ? { accent } : {}),
              updatedAt: now,
            },
          },
        },
      };
      outcome = {
        status: "saved",
        summary: {
          id,
          kind,
          name: entityName(stamped),
          importedAt: now,
          accent,
        },
      };
      return JSON.stringify(stamped, null, 2);
    });
    return outcome;
  }

  /**
   * Replace one existing entity only when its complete canonical revision still matches.
   * The comparison and publish execute under the backend's per-path write lock.
   */
  async compareAndSave(
    raw: unknown,
    expectedRevision: string,
  ): Promise<CompareSaveResult> {
    let entity: AnyEntity;
    try {
      entity = parseCanonicalEntity(raw);
    } catch {
      throw new StudioValidationError("invalid canonical entity");
    }
    const kind = assertStudioEntityKind(entity.kind);
    const id = assertSafeStudioId(entity.id);
    const filePath = resolveStudioPath(this.dir, kind, id);
    const now = new Date().toISOString();
    let outcome: CompareSaveResult = { status: "missing" };

    await this.io.updateAtomic(filePath, (text) => {
      if (text === null) {
        outcome = { status: "missing" };
        return null;
      }
      const existing = parseStoredEntity(text, kind, id);
      if (entityRevision(existing) !== expectedRevision) {
        outcome = { status: "stale" };
        return null;
      }

      const priorUnmapped = {
        ...(existing.original?.["vaud-studio"]?.unmapped ?? {}),
      };
      const importedAt = typeof priorUnmapped["importedAt"] === "string"
        ? priorUnmapped["importedAt"] as string
        : now;
      const priorAccent = priorUnmapped["accent"];
      let accent = typeof priorAccent === "string" ? priorAccent : undefined;
      if (!accent) {
        const art = portraitBytes(entity);
        if (art?.mime === "image/png") accent = signatureFromPng(art.bytes) ?? undefined;
      }

      const stamped: AnyEntity = {
        ...entity,
        original: {
          ...(entity.original ?? {}),
          "vaud-studio": {
            raw: entity.original?.["vaud-studio"]?.raw ?? null,
            unmapped: {
              ...priorUnmapped,
              importedAt,
              ...(accent ? { accent } : {}),
              updatedAt: now,
            },
          },
        },
      };
      outcome = {
        status: "saved",
        summary: {
          id,
          kind,
          name: entityName(stamped),
          importedAt,
          accent,
        },
        revision: entityRevision(stamped),
      };
      return JSON.stringify(stamped, null, 2);
    });

    return outcome;
  }
}
