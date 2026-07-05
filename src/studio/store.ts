/**
 * The studio store - Vaude's local-first "database": a plain folder of canonical entities saved as
 * vaud-json (the lossless native format doubles as the storage format, so the studio is portable,
 * inspectable, and versionable by construction). Folders-as-schema: one subfolder per entity kind,
 * one file per entity. No SQL, no index files - the filesystem is the truth; summaries are derived.
 *
 * Layout: <studioDir>/<kind>/<id>.json  (e.g. studio/character/vera-sandoval.json)
 * Never destructive: saving an id that exists writes a numbered sibling unless overwrite is asked
 * for explicitly (the import journey's Keep both default, enforced at the storage floor).
 */
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { CanonicalEntity } from "../core/canonical";
import { hasPortrait, portraitBytes } from "./portrait";
import { signatureFromPng } from "./signature-color";

type AnyEntity = CanonicalEntity<string, unknown>;

export interface EntitySummary {
  id: string;
  kind: string;
  name: string;
  importedAt?: string;
  /** the entity carries displayable art (serve it via /api/studio/portrait) */
  hasPortrait?: boolean;
  /** the entity's signature color, derived from its own art at import (skin-masked vibrant swatch) */
  accent?: string;
  /** the source format id (first escrow entry that is not our own bookkeeping) */
  sourceFormat?: string;
  /** the source format's variant when it recorded one ("v2", "v3") */
  sourceVariant?: string;
}

/** The entity's source format: the first escrow entry that is not vaud's own bookkeeping slot. */
function sourceOf(entity: AnyEntity): { format?: string; variant?: string } {
  for (const [formatId, entry] of Object.entries(entity.escrow ?? {})) {
    if (formatId === "vaud-studio") continue;
    const variant = entry?.unmapped?.["variant"];
    return { format: formatId, variant: typeof variant === "string" ? variant : undefined };
  }
  return {};
}

const KIND_DIRS = ["character", "lorebook", "persona"] as const;

/** A name pulled tolerantly off any canonical body (each kind roots it differently). */
function entityName(entity: AnyEntity): string {
  const body = entity.body as Record<string, unknown> | undefined;
  if (!body) return entity.id;
  const identity = body.identity as { name?: string } | undefined;
  if (typeof identity?.name === "string" && identity.name) return identity.name;
  if (typeof body.name === "string" && body.name) return body.name;
  return entity.id;
}

export class StudioStore {
  constructor(private readonly dir: string) {}

  private kindDir(kind: string): string {
    return join(this.dir, kind);
  }

  async list(kind?: string): Promise<EntitySummary[]> {
    const kinds = kind ? [kind] : [...KIND_DIRS];
    const out: EntitySummary[] = [];
    for (const k of kinds) {
      let files: string[];
      try {
        files = await readdir(this.kindDir(k));
      } catch {
        continue; // kind folder not created yet = empty shelf, not an error
      }
      for (const f of files.filter((n) => n.endsWith(".json")).sort()) {
        const entity = await this.read(k, f.slice(0, -5));
        if (entity) {
          const studioMeta = entity.escrow?.["vaud-studio"]?.unmapped;
          const accent = studioMeta?.["accent"];
          const source = sourceOf(entity);
          out.push({
            id: f.slice(0, -5),
            kind: k,
            name: entityName(entity),
            importedAt: (studioMeta?.["importedAt"] as string) ?? undefined,
            hasPortrait: hasPortrait(entity),
            accent: typeof accent === "string" && /^#[0-9a-f]{6}$/i.test(accent) ? accent : undefined,
            sourceFormat: source.format,
            sourceVariant: source.variant,
          });
        }
      }
    }
    return out;
  }

  async read(kind: string, id: string): Promise<AnyEntity | null> {
    try {
      const text = await Bun.file(join(this.kindDir(kind), `${id}.json`)).text();
      const parsed = JSON.parse(text) as AnyEntity;
      return parsed && typeof parsed === "object" && typeof parsed.kind === "string" ? parsed : null;
    } catch {
      return null; // tolerant reader: missing/corrupt reads as absent, never throws to the surface
    }
  }

  /**
   * Save an entity; returns its summary. Default is KEEP BOTH: an occupied id gets a numbered
   * sibling (vera, vera-2, vera-3...) so user data is never silently replaced.
   */
  async save(entity: AnyEntity, opts?: { overwrite?: boolean }): Promise<EntitySummary> {
    if (typeof entity?.kind !== "string" || !entity.kind) throw new Error("studio: entity has no kind");
    const dir = this.kindDir(entity.kind);
    await mkdir(dir, { recursive: true });

    const base = entity.id && typeof entity.id === "string" ? entity.id : "untitled";
    let id = base;
    if (!opts?.overwrite) {
      let n = 2;
      while (await Bun.file(join(dir, `${id}.json`)).exists()) id = `${base}-${n++}`;
    }

    // derive the signature color ONCE at save (skin-masked vibrant swatch of the card's own art);
    // regenerable bookkeeping, so it lives in our vaud-studio escrow, never in the authored body
    const prior = entity.escrow?.["vaud-studio"]?.unmapped?.["accent"];
    let accent = typeof prior === "string" ? prior : undefined;
    if (!accent) {
      const art = portraitBytes(entity);
      if (art?.mime === "image/png") accent = signatureFromPng(art.bytes) ?? undefined;
    }

    const stamped: AnyEntity = {
      ...entity,
      id,
      escrow: {
        ...(entity.escrow ?? {}),
        "vaud-studio": {
          raw: entity.escrow?.["vaud-studio"]?.raw ?? null,
          unmapped: { importedAt: new Date().toISOString(), ...(accent ? { accent } : {}) },
        },
      },
    };
    await Bun.write(join(dir, `${id}.json`), JSON.stringify(stamped, null, 2));
    return { id, kind: entity.kind, name: entityName(stamped), importedAt: new Date().toISOString(), accent };
  }
}
