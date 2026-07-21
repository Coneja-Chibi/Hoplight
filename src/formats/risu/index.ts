/**
 * RisuAI .charx adapter. A .charx is a ZIP of `card.json` (a CCv3 card) + `assets/` files,
 * optionally `module.risum`. The card.json is a Tavern V3 card, so we reuse the shared V3
 * field mapping + the shared asset mapping; the zip container is handled here. Field map in
 * Field map: design/RISU-CARD-DEEP.md. Lossless:
 * raw card + asset bytes + module ride original, including opaque executable content we never run.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import coverage from "./coverage";
import { type TavernData, dataToBody, applyBodyToData, wrapV3 } from "../_shared/tavern-fields";
import { applyRisuToBody, applyBodyToRisu } from "./risu-fields";
import { assetsToMedia, applyMediaToTavernData } from "../_shared/assets";
import { embedCharacterBook } from "../_shared/character-book";
import lorebookCodec from "./lorebook";
import { regexAdapter } from "./regex";
import { openRisumModule, type OpenedRisumModule } from "./open-module";
import { encodeRisumSmart } from "./rpack";
import { zipSync, strToU8, strFromU8 } from "fflate";
import { CARD_ARCHIVE_BOUNDS, unzipBounded } from "../../core/archive";

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");
const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

/**
 * Risu writes creation/modification dates in MILLISECONDS; the CCv3 spec says seconds. Normalize to
 * seconds for the canonical model (a real seconds timestamp never exceeds this until ~year 5138, so a
 * larger value is unambiguously milliseconds). The raw ms value is restored verbatim on export.
 */
const MS_THRESHOLD = 1e11;
const msToSeconds = (n: number | undefined): number | undefined =>
  typeof n === "number" && n > MS_THRESHOLD ? Math.floor(n / 1000) : n;

/** Bounded unzip; `only` restricts to a single entry name (detection path). */
function safeUnzip(bytes: Uint8Array, only?: string): Record<string, Uint8Array> {
  return unzipBounded(bytes, { bounds: CARD_ARCHIVE_BOUNDS, only });
}

interface V3Card {
  spec: string;
  spec_version: string;
  data: TavernData;
}

function baseCard(): V3Card {
  return wrapV3({
    name: "", description: "", personality: "", scenario: "", first_mes: "", mes_example: "",
    creator_notes: "", system_prompt: "", post_history_instructions: "",
    alternate_greetings: [], group_only_greetings: [], tags: [], creator: "",
    character_version: "1.0", extensions: {},
  });
}

/**
 * True if the card carries content vaud must treat as opaque and never execute: Risu trigger/virtual
 * scripts, a custom-HTML background, or a bundled module. Surfaced on original so consumers can gate it.
 */
function hasExecutableContent(data: TavernData, moduleRisum: string | undefined): boolean {
  const ext = isRecord(data.extensions) ? data.extensions : {};
  const risuai = isRecord(ext.risuai) ? ext.risuai : {};
  return Boolean(
    (Array.isArray(risuai.triggerscript) && risuai.triggerscript.length > 0) ||
      (typeof risuai.virtualscript === "string" && risuai.virtualscript.length > 0) ||
      (typeof risuai.backgroundHTML === "string" && risuai.backgroundHTML.length > 0) ||
      moduleRisum,
  );
}

/** True if the card requested Risu's privileged low-level script API; its scripts must never auto-run. */
const isPrivileged = (data: TavernData): boolean => {
  const ext = isRecord(data.extensions) ? data.extensions : {};
  const risuai = isRecord(ext.risuai) ? ext.risuai : {};
  return risuai.lowLevelAccess === true;
};

const adapter: CharacterAdapter = {
  id: "risu",
  label: "RisuAI .charx (zip: card.json + assets)",
  outputExtensions: ["charx"],
  kind: "character",
  coverage,

  detect(input: AdapterInput): number {
    const b = input.bytes;
    if (!b || b[0] !== 0x50 || b[1] !== 0x4b) return 0; // not a zip ("PK")
    try {
      return safeUnzip(b, "card.json")["card.json"] ? 1 : 0;
    } catch {
      return 0;
    }
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    if (!input.bytes) throw new Error("risu: .charx needs bytes");
    const files = safeUnzip(input.bytes);
    const cardBytes = files["card.json"];
    if (!cardBytes) throw new Error("risu: no card.json in .charx");
    const parsed = JSON.parse(strFromU8(cardBytes)) as unknown;
    if (!parsed || typeof parsed !== "object" || typeof (parsed as V3Card).data !== "object") {
      throw new Error("risu: card.json has no data object");
    }
    const card = parsed as V3Card;

    const body = dataToBody(card.data);
    applyRisuToBody(card.data, body); // authored risuai scalars -> first-class slots (de-original)
    body.media = assetsToMedia(card.data.assets);
    body.attribution.createdAt = msToSeconds(body.attribution.createdAt);
    body.attribution.updatedAt = msToSeconds(body.attribution.updatedAt);

    const assetFiles: Record<string, string> = {};
    let moduleRisum: string | undefined;
    let moduleBytes: Uint8Array | undefined;
    for (const [path, data] of Object.entries(files)) {
      if (path === "card.json") continue;
      if (path === "module.risum") {
        moduleRisum = b64(data);
        moduleBytes = data;
        continue;
      }
      assetFiles[path] = b64(data);
    }

    // Structured module when RPack decode succeeds; raw base64 always kept for lossless export.
    const openedModule = moduleBytes ? openRisumModule(moduleBytes) : null;

    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(card.data.name),
      body,
      original: {
        risu: {
          raw: card,
          unmapped: {
            assetFiles,
            moduleRisum,
            ...(openedModule ? { module: openedModule } : {}),
            hasExecutableContent: hasExecutableContent(card.data, moduleRisum),
            privileged: isPrivileged(card.data),
          },
        },
      },
    };
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const esc = entity.original?.risu;
    const card = (esc?.raw ? structuredClone(esc.raw) : baseCard()) as V3Card;

    // Preserve Risu's original millisecond dates: the canonical body carries them in seconds, so
    // restore the raw values after the shared mapping writes its (seconds) versions back.
    const rawCreated = card.data.creation_date;
    const rawModified = card.data.modification_date;
    applyBodyToData(card.data, entity.body);
    applyMediaToTavernData(card.data, entity.body.media, "risu");
    applyBodyToRisu(card.data, entity.body); // de-kept risuai scalars, twin-diffed
    if (rawCreated !== undefined) card.data.creation_date = rawCreated;
    if (rawModified !== undefined) card.data.modification_date = rawModified;

    // Risu's card.json is CCv3, so a referenced lorebook re-embeds into its character_book slot.
    if (context?.lorebooks?.length) embedCharacterBook(card.data as Record<string, unknown>, context.lorebooks);

    const files: Record<string, Uint8Array> = {
      "card.json": strToU8(JSON.stringify(card, null, 4)),
    };
    const assetFiles = (esc?.unmapped?.["assetFiles"] as Record<string, string> | undefined) ?? {};
    for (const [path, s] of Object.entries(assetFiles)) files[path] = unb64(s);
    const moduleRisum = esc?.unmapped?.["moduleRisum"] as string | undefined;
    if (moduleRisum) {
      const raw = unb64(moduleRisum);
      const opened = esc?.unmapped?.["module"] as OpenedRisumModule | undefined;
      // Unedited: emit original package bytes. Edited: encodeRisumSmart throws in safe-block mode.
      files["module.risum"] =
        opened?.module != null ? encodeRisumSmart(raw, opened.module) : raw;
    }

    return { bytes: zipSync(files), suggestedExtension: "charx" };
  },
};

/** The RisuAI family's character codec, exported by name for direct importers (tests, bundle). */
export { adapter as characterAdapter };

/** The STABLE seam for consumers outside this family (the Workshop's packaged-module reader):
 * the rpack submodule layout is internal and may reshuffle; this named surface will not. */
export { listScriptEffects } from "./rpack";
export type { RisuModule } from "./rpack/module";

/** Folders-as-schema: this format family exports every codec it provides (character + native lore +
 * regex scripts). The regex codec claims bare .risum modules with regex rows and customscript-row
 * JSON arrays; .charx zips still belong to the character adapter (its 1.0 outbids). */
export default [adapter, lorebookCodec, regexAdapter];
