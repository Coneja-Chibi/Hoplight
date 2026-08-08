/**
 * The studio store - Hoplight local-first entity storage with path containment and atomic writes.
 */
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../entities/runtime-schema";
import { entityRevision } from "../entities/canonical-revision";
import { StudioConflictError, StudioWriteError } from "./atomic-file";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import { looksCanonical, parseStoredEntity } from "./stored-entity";
import { authoredSignature, entityName, HEX6, sourceOf } from "./summary";
import {
  StudioNotFoundError,
  StudioReadError,
  StudioValidationError,
  type StudioDamageReason,
} from "./errors";
import type { ForeignReader } from "./foreign";
import { createForeignIndex, type ForeignIndex } from "./foreign-index";
import {
  assertSafeStudioId,
  assertStudioEntityKind,
  resolveStudioPath,
  STUDIO_ENTITY_KINDS,
  type StudioEntityKind,
} from "./path-policy";
import { join } from "node:path";
import { hasPortrait, portraitBytes } from "./portrait";
export { entityName } from "./summary";
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
  /**
   * True when this piece is a file in another platform format, read through its adapter rather than
   * stored canonically. Read-only: its source file is never written to.
   */
  foreign?: boolean;
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





/**
 * The files in a kind folder worth looking at.
 *
 * A DOTFILE IS AN ARTIFACT, not somebody's file: atomic replacement leaves .tmp orphans behind, and
 * reporting one as a badly named piece is noise standing exactly where the useful report goes.
 * Sorted, because the id a foreign file gets depends on the order they are walked in.
 */
const usableFiles = (files: readonly string[]): string[] =>
  files.filter((n) => n.endsWith(".json") && !n.startsWith(".")).sort();

export class StudioStore {
  // the fs backend is the ONE injection point: node fs on desktop/CLI, OPFS in the pocket build
  constructor(
    private readonly dir: string,
    private readonly io: StudioFs = nodeStudioFs,
    /**
     * Reads a file that is not canonical through a format adapter, so a SillyTavern export sitting in
     * the preset folder is a preset rather than a silence. Injected because detection lives in the
     * format registry at the app layer, and a studio that imported it would invert the dependency.
     */
    private readonly foreign?: ForeignReader,
  ) {}

  /** Built lazily by the getter below, which is where the reasoning lives. */
  private index: ForeignIndex | null = null;

  /**
   * Files in this studio that are not canonical, read through their own format's adapter.
   *
   * Built on first use rather than as a field, because a field initializer runs before the
   * constructor's parameter properties exist and would capture an undefined io.
   *
   * `canonicalId` is how it knows which ids are already spoken for: the store owns parsing, so the
   * index asks rather than reimplementing it and drifting away from it.
   */
  private get foreignIndex(): ForeignIndex {
    this.index ??= createForeignIndex({
      io: this.io,
      ...(this.foreign ? { read: this.foreign } : {}),
      canonicalId: (text, kind, id) => {
        try {
          assertSafeStudioId(id);
          return parseStoredEntity(text, kind, id).id;
        } catch {
          return null;
        }
      },
    });
    return this.index;
  }



  /** Where this studio lives on disk (About shows it; never used for writes outside resolve). */
  studioPath(): string {
    return this.dir;
  }

  /**
   * One filesystem pass for healthy summaries, foreign pieces, and fail-closed damage records.
   *
   * THREE OUTCOMES PER FILE, and the third is the one that was missing. A canonical file lists as
   * itself. A file in another platform format lists through its adapter, because a SillyTavern
   * export in the preset folder is a preset and reading one is what this repository already does
   * everywhere else. Only a file that is neither is damage, and it is REPORTED rather than skipped:
   * a real studio of 147 presets listed three and said nothing about the rest.
   */
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
      const usable = usableFiles(files);
      // The SAME index read() uses, so an id means one piece through either door.
      const foreign = await this.foreignIndex.forKind(k, kindDir, usable);
      const byFile = new Map([...foreign].map(([id, entry]) => [entry.file, id]));

      for (const f of usable) {
        const id = f.slice(0, -5);
        const foreignAs = byFile.get(f);
        if (foreignAs !== undefined) {
          const piece = foreign.get(foreignAs)!.piece;
          const body = piece.entity.body as { name?: unknown } | undefined;
          entities.push({
            id: foreignAs,
            kind: k,
            name: typeof body?.name === "string" && body.name ? body.name : id,
            sourceFormat: piece.format,
            foreign: true,
          });
          continue;
        }
        try {
          assertSafeStudioId(id);
        } catch {
          /**
           * The name cannot be an id. Whether that is the ONLY thing wrong decides what to tell
           * somebody, so it is checked rather than assumed.
           *
           * A canonical file called `ludovic-&-levi.json` is 2.4MB of somebody's work that loads
           * perfectly the moment it is renamed. A SillyTavern fragment called `Loggo's Preset.json`
           * does not, and telling its owner to rename it sends them to do a pointless thing and
           * come back to the same list. Both used to report identically.
           */
          const text = await this.io.readText(join(kindDir, f));
          const ours = text !== null && looksCanonical(text, k);
          damaged.push({ kind: k, id, reason: ours ? "unusable-filename" : "schema-mismatch" });
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
            reason: error instanceof StudioReadError && error.reason ? error.reason : "unreadable-json",
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
    /**
     * THE ID IS VALIDATED FIRST, AND AN INVALID ONE STILL THROWS.
     *
     * The first version of the foreign fallback wrapped this resolve in a try/catch and returned
     * null, which quietly turned a rejected traversal into a miss. The containment test caught it.
     * Nothing escaped, because the fallback only ever opens files it got from listDir, but a caller
     * relying on an invalid id being refused would have been relying on nothing.
     *
     * A foreign piece is addressed by a SLUG, which is a valid id by construction, so validating
     * first costs it nothing.
     */
    const path = resolveStudioPath(this.dir, kind, id);
    const text = await this.io.readText(path);
    if (text !== null) {
      try {
        return parseStoredEntity(text, kind, id);
      } catch (error) {
        /**
         * A FILE CAN SIT AT THE CANONICAL PATH AND STILL NOT BE OURS.
         *
         * `3035a5467e03eaa245de3ac318018404.json` is a perfectly legal id, so this resolves, reads,
         * and then fails to parse because the contents are a SillyTavern export. The first version
         * threw here, which listed the piece through the adapter and then refused to open it: six of
         * a hundred and forty, and only findable by reading every one of them back.
         *
         * If the adapters cannot make sense of it either, the ORIGINAL error is what gets raised,
         * because that is the one that says what is actually wrong with the file.
         */
        const adapted = await this.readForeignById(kind, id);
        if (adapted) return adapted;
        throw error;
      }
    }
    // No file answers to this id. It may still be a foreign piece listed under a slug.
    return this.readForeignById(kind, id);
  }

  /** Find the foreign file whose id this is, through the shared index. Null when there is none. */
  private async readForeignById(kind: string, id: string): Promise<AnyEntity | null> {
    const k = assertStudioEntityKind(kind);
    const kindDir = resolveStudioPath(this.dir, k);
    const files = await this.io.listDir(kindDir);
    if (files === null) return null;
    const found = (await this.foreignIndex.forKind(k, kindDir, usableFiles(files))).get(id);
    if (!found) return null;
    // The id it reports is the one it was ASKED for, so every later reference resolves back here.
    return { ...(found.piece.entity as object), id, schemaVersion: "1" } as AnyEntity;
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
