/**
 * The studio store - Vaude local-first entity storage with path containment and atomic writes.
 */
import { mkdir, readdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import type { CanonicalEntity } from "../core/canonical";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import {
  writeAtomicReplace,
  writeExclusive,
  StudioConflictError,
  StudioWriteError,
} from "./atomic-file";
import { StudioNotFoundError, StudioReadError, StudioValidationError } from "./errors";
import {
  assertSafeStudioId,
  assertStudioEntityKind,
  resolveStudioPath,
  STUDIO_ENTITY_KINDS,
  type StudioEntityKind,
} from "./path-policy";
import { hasPortrait, portraitBytes } from "./portrait";
import { signatureFromPng } from "./signature-color";

type AnyEntity = CanonicalEntity<string, unknown>;

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
  const body = entity.body as Record<string, unknown> | undefined;
  if (!body) return entity.id;
  const identity = body.identity as { name?: string } | undefined;
  if (typeof identity?.name === "string" && identity.name) return identity.name;
  if (typeof body.name === "string" && body.name) return body.name;
  return entity.id;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export class StudioStore {
  constructor(private readonly dir: string) {}

  async list(kind?: string): Promise<EntitySummary[]> {
    const kinds: StudioEntityKind[] = kind
      ? [assertStudioEntityKind(kind)]
      : [...STUDIO_ENTITY_KINDS];
    const out: EntitySummary[] = [];
    for (const k of kinds) {
      const kindDir = resolveStudioPath(this.dir, k);
      let files: string[];
      try {
        files = await readdir(kindDir);
      } catch (e) {
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code === "ENOENT") continue;
        throw new StudioReadError();
      }
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
          out.push({
            id,
            kind: k,
            name: entityName(entity),
            importedAt: (studioMeta?.["importedAt"] as string) ?? undefined,
            hasPortrait: hasPortrait(entity),
            accent: authoredSignature(entity) ?? artAccent,
            sourceFormat: source.format,
            sourceVariant: source.variant,
          });
        } catch {
          continue;
        }
      }
    }
    return out;
  }

  async read(kind: string, id: string): Promise<AnyEntity | null> {
    const path = resolveStudioPath(this.dir, kind, id);
    let text: string;
    try {
      text = await Bun.file(path).text();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return null;
      throw new StudioReadError();
    }
    let parsed: AnyEntity;
    try {
      parsed = JSON.parse(text) as AnyEntity;
    } catch {
      throw new StudioReadError("corrupt entity file");
    }
    if (!parsed || typeof parsed !== "object") throw new StudioReadError("corrupt entity file");
    if (parsed.schemaVersion !== CANONICAL_SCHEMA_VERSION) {
      throw new StudioReadError("corrupt entity file");
    }
    if (typeof parsed.kind !== "string" || parsed.kind !== kind) {
      throw new StudioReadError("corrupt entity file");
    }
    if (typeof parsed.id !== "string" || parsed.id !== id) {
      throw new StudioReadError("corrupt entity file");
    }
    if (parsed.body === null || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
      throw new StudioReadError("corrupt entity file");
    }
    const legacy = (parsed as { escrow?: unknown }).escrow;
    if (legacy !== undefined && parsed.original === undefined) {
      parsed.original = legacy as AnyEntity["original"];
    }
    delete (parsed as { escrow?: unknown }).escrow;
    return parsed;
  }

  async save(entity: AnyEntity, opts?: { overwrite?: boolean }): Promise<EntitySummary> {
    const kind = assertStudioEntityKind(entity?.kind);
    if (typeof entity.id !== "string" || !entity.id) {
      throw new StudioValidationError("invalid entity id");
    }
    // Fail closed on what read() would refuse: without this, save writes a file that list/read
    // then treat as corrupt forever - the piece exists on disk but never appears in the studio.
    if (entity.schemaVersion !== CANONICAL_SCHEMA_VERSION) {
      throw new StudioValidationError(
        `entity schemaVersion must be "${CANONICAL_SCHEMA_VERSION}"`,
      );
    }
    let id = assertSafeStudioId(entity.id);
    const kindDir = resolveStudioPath(this.dir, kind);
    await mkdir(kindDir, { recursive: true });

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
    } else {
      let n = 2;
      let candidate = id;
      while (await pathExists(resolveStudioPath(this.dir, kind, candidate))) {
        candidate = `${id}-${n++}`;
        assertSafeStudioId(candidate);
      }
      id = candidate;
    }

    const priorAccent = priorUnmapped["accent"];
    let accent = typeof priorAccent === "string" ? priorAccent : undefined;
    if (!accent) {
      const art = portraitBytes({ ...entity, id, kind });
      if (art?.mime === "image/png") accent = signatureFromPng(art.bytes) ?? undefined;
    }

    const importedAt = priorImportedAt ?? now;
    const stamped: AnyEntity = {
      ...entity,
      kind,
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
      if (opts?.overwrite) await writeAtomicReplace(filePath, body);
      else await writeExclusive(filePath, body);
    } catch (e) {
      if (e instanceof StudioConflictError && !opts?.overwrite) {
        let n = 2;
        const base = assertSafeStudioId(entity.id);
        let candidate = base;
        while (await pathExists(resolveStudioPath(this.dir, kind, candidate))) {
          candidate = `${base}-${n++}`;
          assertSafeStudioId(candidate);
        }
        id = candidate;
        const retry: AnyEntity = { ...stamped, id };
        await writeExclusive(resolveStudioPath(this.dir, kind, id), JSON.stringify(retry, null, 2));
        return { id, kind, name: entityName(retry), importedAt, accent };
      }
      if (e instanceof StudioWriteError || e instanceof StudioConflictError) throw e;
      throw new StudioWriteError();
    }

    return { id, kind, name: entityName(stamped), importedAt, accent };
  }
}
