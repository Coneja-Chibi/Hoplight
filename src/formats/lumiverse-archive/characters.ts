/**
 * The character slice (spec Behavior step 4 for the portrait, step 5 for the character row, step 7
 * for isolation; edge case 7 for the extensions exception). A `characters` row is CCv2 fields
 * flattened plus an `extensions` JSON string, so this synthesizes a CCv2 card and dispatches through
 * the already-shipped Lumiverse character adapter (src/formats/lumiverse/index.ts) via `inspectBundle`
 * (src/convert.ts), which also extracts any embedded `character_book` into a standalone lorebook. No
 * card-field mapping or sprite/expression rehydration lives here twice; both already exist in that
 * codec.
 *
 * A row whose `extensions.lumiverse_modules` sub-object is present dispatches through the codec's
 * ZIP path: `rehydrateCardData` (src/formats/lumiverse/modules.ts) never looks inside the card's own
 * `extensions` for modules, only at a SEPARATE `lumiverse_modules.json` sidecar, so the sub-object has
 * to be LIFTED out of the card and re-homed as that sidecar for the codec's sprite/asset resolution
 * to engage at all. A row with no modules dispatches the plain card JSON text instead; zipping an
 * archive with nothing module-shaped in it would cost real work for no behavior difference.
 *
 * The portrait is resolved AFTER dispatch, the same doctrine as the persona slice: `avatar_path`,
 * then a join through `images` via `image_id`, then the same join via `avatar_crop_image_id`, first
 * hit wins. This only ever writes `entity.body.media.portrait`, never any escrow twin: the codec's
 * own twin and the archive's raw-row twin both keep whatever avatar/image references the row
 * actually had, exactly as read.
 *
 * `character_gallery` is a feeder table, not its own kind (tables.ts: TABLE_KINDS.character_gallery
 * is null): its rows join a character's own extra images onto `body.media.assets`, ordered by
 * `sort_order`, through the same images-map + binaries resolution the portrait uses. Only the four
 * join-essential columns (id, character_id, image_id, sort_order) are read; a real export's other
 * gallery columns cost nothing here, since column presence is the compatibility contract (edge case
 * 3), not a fixed row shape this module has to match exactly.
 */
import { zipSync, strToU8 } from "fflate";
import type { CanonicalCharacter, MediaAsset } from "../../entities/character/schema";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { characterAdapter } from "../lumiverse";
import type { LumiModules } from "../lumiverse/modules";
import { wrapV2, type TavernData } from "../_shared/tavern-fields";
import { toAdapterInput } from "../../core";
import { inspectBundle } from "../../convert";
import type { Binaries } from "./binaries";
import { addArchiveEscrow } from "./escrow";
import type { LinkMap } from "./links";
import { addWarning, recordFailure, recordImported, type LvbakImportReport } from "./report";
import type { LvbakEntrySource } from "./source";
import { readTable, type ReadTableOptions, type TableRow } from "./table-walk";
import { rowId } from "./tables";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asStringArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
const rawExtensions = (v: unknown): Record<string, unknown> | undefined => (isRec(v) ? v : undefined);
/** Same string-or-number tolerance as rowId, for a foreign key column rather than a row's own id. */
const asId = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

export interface CharacterCardFields {
  tags?: string[];
  alternateGreetings?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Build the CCv2 `data` object from a character row's flat columns plus its already-decided extra
 * fields (the caller has already resolved the inner-JSON policy: which of tags/alternate_greetings/
 * extensions parsed, and whether extensions still carries `lumiverse_modules`).
 */
export function characterRowToCard(row: Record<string, unknown>, fields: CharacterCardFields): TavernData {
  const card: TavernData = {
    name: asString(row.name),
    description: asString(row.description),
    personality: asString(row.personality),
    scenario: asString(row.scenario),
    first_mes: asString(row.first_mes),
    mes_example: asString(row.mes_example),
    system_prompt: asString(row.system_prompt),
    post_history_instructions: asString(row.post_history_instructions),
    creator: asString(row.creator),
    creator_notes: asString(row.creator_notes),
  };
  if (fields.tags) card.tags = fields.tags;
  if (fields.alternateGreetings) card.alternate_greetings = fields.alternateGreetings;
  if (fields.extensions) card.extensions = fields.extensions;
  return card;
}

/**
 * Resolve every `files/`-relative path named by `modules.expressions.mappings` against the archive,
 * for embedding at the SAME key in the synthetic dispatch zip. A ref with no matching entry is simply
 * left out (its binary is absent; `binaries.bytes` already recorded that), never an error: the codec's
 * own `resolveAssetRef` leaves an unresolved ref as the bare path rather than fabricating anything.
 *
 * Scoped to expressions on purpose: it is the sprite path the spec and the codec both name, and the
 * only piece of `lumiverse_modules` this fixture set proves resolves end to end. `alternate_avatars`
 * and the rest of LumiModules ride the sidecar untouched but unresolved here.
 */
async function collectModuleFiles(
  modules: LumiModules,
  binaries: Binaries,
): Promise<Record<string, Uint8Array>> {
  const refs = Object.values(modules.expressions?.mappings ?? {}).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const files: Record<string, Uint8Array> = {};
  for (const ref of refs) {
    const bytes = await binaries.bytes(ref);
    if (bytes) files[ref] = bytes;
  }
  return files;
}

const dataUriMime = (uri: string): string | undefined => /^data:([^;]+);/.exec(uri)?.[1];

/**
 * `avatar_path` first; when absent or absent-from-the-archive, `image_id` joined through the images
 * map; when that also misses, `avatar_crop_image_id` the same way. First data: URI wins. A row that
 * references nothing at all is left alone: nothing was referenced, so nothing is "missing" either.
 */
async function resolvePortrait(
  entity: CanonicalCharacter,
  row: Record<string, unknown>,
  binaries: Binaries,
  images: ReadonlyMap<string, TableRow>,
): Promise<void> {
  let dataUri: string | null = null;

  const avatarPath = typeof row.avatar_path === "string" ? row.avatar_path : "";
  if (avatarPath) dataUri = await binaries.avatarDataUri(avatarPath);

  if (!dataUri) {
    const imageId = typeof row.image_id === "string" ? row.image_id : "";
    const imageRow = imageId ? images.get(imageId) : undefined;
    if (imageRow) dataUri = await binaries.imageDataUri(imageRow.row);
  }

  if (!dataUri) {
    const cropId = typeof row.avatar_crop_image_id === "string" ? row.avatar_crop_image_id : "";
    const cropRow = cropId ? images.get(cropId) : undefined;
    if (cropRow) dataUri = await binaries.imageDataUri(cropRow.row);
  }

  if (dataUri) {
    entity.body.media.portrait = { role: "portrait", ref: dataUri, mime: dataUriMime(dataUri), primary: true };
  }
}

export interface GalleryRow {
  id: string;
  characterId: string;
  imageId: string;
  sortOrder: number;
}

/**
 * Read character_gallery once and bucket rows by character_id, each bucket sorted by sort_order. A
 * row naming no character_id can never be attached to anything, so it is dropped here rather than
 * carried forward as an orphan; a row naming a character that never appears (or never imports) in
 * the characters table is never looked up at all, since only characters actually read call in here.
 */
export async function indexCharacterGallery(
  source: LvbakEntrySource,
  opts: ReadTableOptions,
): Promise<Map<string, GalleryRow[]>> {
  const byCharacter = new Map<string, GalleryRow[]>();
  for await (const read of readTable(source, "character_gallery", opts)) {
    const row = read.row;
    const characterId = asId(row.character_id);
    if (!characterId) continue;
    const galleryRow: GalleryRow = {
      id: rowId(row),
      characterId,
      imageId: asId(row.image_id),
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    };
    let bucket = byCharacter.get(characterId);
    if (!bucket) {
      bucket = [];
      byCharacter.set(characterId, bucket);
    }
    bucket.push(galleryRow);
  }
  for (const bucket of byCharacter.values()) bucket.sort((a, b) => a.sortOrder - b.sortOrder);
  return byCharacter;
}

/**
 * Append this character's gallery images to `body.media.assets`, in sort_order. `role: "other"` is
 * the closest fit in MediaAsset's role set (assetsToMedia's own precedent: nothing that is not a
 * portrait/emotion/outfit/pose/background lands there too); `label` is the resolved image row's own
 * filename, the only human-readable name a gallery row's own four columns leave available. A row
 * whose image_id resolves to no images-table row, or whose file is absent (binaries.imageDataUri
 * already recorded the miss), contributes nothing and never fails the character.
 */
async function appendGalleryAssets(
  entity: CanonicalCharacter,
  characterId: string,
  gallery: ReadonlyMap<string, GalleryRow[]>,
  images: ReadonlyMap<string, TableRow>,
  binaries: Binaries,
): Promise<void> {
  const rows = gallery.get(characterId);
  if (!rows) return;

  const assets: MediaAsset[] = [];
  for (const row of rows) {
    const imageRow = row.imageId ? images.get(row.imageId) : undefined;
    if (!imageRow) continue;
    const dataUri = await binaries.imageDataUri(imageRow.row);
    if (!dataUri) continue;
    const label = typeof imageRow.row.filename === "string" ? imageRow.row.filename : undefined;
    assets.push({ role: "other", label, ref: dataUri, mime: dataUriMime(dataUri) });
  }
  if (assets.length > 0) {
    entity.body.media.assets = [...(entity.body.media.assets ?? []), ...assets];
  }
}

export interface ImportCharactersOptions {
  lineCeiling: number;
  report: LvbakImportReport;
  links: LinkMap;
  binaries: Binaries;
  images: ReadonlyMap<string, TableRow>;
}

/**
 * Import every character, plus any lorebook embedded in its card (spec Behavior step 5) and any
 * gallery images its own character_gallery rows name. Failure isolation stops at the column: per
 * edge case 7, a character never fails the row over a bad inner-JSON column, it just loses whichever
 * column would not parse, with `extensions` specifically raising a named warning since losing it
 * means losing sprites, the embedded book, and every foreign-platform escrow key at once. A
 * codec-level throw is NOT caught here; the row-level outer catch is the M9 orchestrator's job.
 */
export async function importCharacters(
  source: LvbakEntrySource,
  options: ImportCharactersOptions,
): Promise<ParsedCanonicalEntity[]> {
  const { lineCeiling, report, links, binaries, images } = options;
  const opts: ReadTableOptions = {
    lineCeiling,
    onFailure: (failure) => recordFailure(report, failure),
  };

  const gallery = await indexCharacterGallery(source, opts);

  const out: ParsedCanonicalEntity[] = [];
  for await (const read of readTable(source, "characters", opts)) {
    const failed = new Set(read.inner.failures.map((f) => f.column));

    const tags = failed.has("tags") ? undefined : asStringArray(read.inner.values.tags);
    const alternateGreetings = failed.has("alternate_greetings")
      ? undefined
      : asStringArray(read.inner.values.alternate_greetings);

    let extensions = failed.has("extensions") ? undefined : rawExtensions(read.inner.values.extensions);
    if (failed.has("extensions")) {
      const name = asString(read.row.name) || `row ${rowId(read.row) || read.line}`;
      addWarning(
        report,
        `"${name}" imported without its extensions data; the archive's copy would not parse.`,
      );
    }

    let modules: LumiModules | undefined;
    if (extensions && isRec(extensions.lumiverse_modules)) {
      modules = extensions.lumiverse_modules as unknown as LumiModules;
      extensions = { ...extensions };
      delete extensions.lumiverse_modules;
    }

    const envelope = wrapV2(characterRowToCard(read.row, { tags, alternateGreetings, extensions }));

    const input = modules
      ? toAdapterInput(
          zipSync({
            "card.json": strToU8(JSON.stringify(envelope)),
            "lumiverse_modules.json": strToU8(JSON.stringify(modules)),
            ...(await collectModuleFiles(modules, binaries)),
          }),
          "character.charx",
        )
      : toAdapterInput(strToU8(JSON.stringify(envelope)), "character.json");

    const { entity, lorebooks } = inspectBundle(characterAdapter, input);
    await resolvePortrait(entity, read.row, binaries, images);
    await appendGalleryAssets(entity, rowId(read.row), gallery, images, binaries);

    const escrowed = addArchiveEscrow(entity, "characters", read.row);
    links.record("characters", rowId(read.row), { id: escrowed.id, name: escrowed.body.identity.name });
    recordImported(report, "character", { id: escrowed.id, name: escrowed.body.identity.name });
    out.push(escrowed);

    for (const book of lorebooks) {
      recordImported(report, "lorebook", { id: book.id, name: book.body.name });
      out.push(book);
    }
  }
  return out;
}
