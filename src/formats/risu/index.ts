/**
 * RisuAI .charx adapter. A .charx is a ZIP of `card.json` (a CCv3 card) + `assets/` files,
 * optionally `module.risum`. The card.json is a Tavern V3 card, so we reuse the shared V3
 * field mapping + the shared asset mapping; the zip container is handled here. Field map in
 * design/RISU-CARD-DEEP.md (extracted clean-room from card DATA, never Risu source). Lossless:
 * raw card + asset bytes + module ride escrow, including opaque executable content we never run.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { type TavernData, dataToBody, applyBodyToData, wrapV3 } from "../_shared/tavern-fields";
import { assetsToMedia } from "../_shared/assets";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

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

/** Cap per-entry inflated size so a zip bomb cannot OOM us during detection or conversion. */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/**
 * unzip with a decompression-bomb guard: entries larger than the cap are filtered out BEFORE
 * inflation (fflate applies the filter pre-decompress). `only` restricts to a single entry name.
 */
function safeUnzip(bytes: Uint8Array, only?: string): Record<string, Uint8Array> {
  return unzipSync(bytes, {
    filter: (f) => (only ? f.name === only : true) && f.size <= MAX_ENTRY_BYTES,
  });
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
 * scripts, a custom-HTML background, or a bundled module. Surfaced on escrow so consumers can gate it.
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
    body.media = assetsToMedia(card.data.assets);
    body.attribution.createdAt = msToSeconds(body.attribution.createdAt);
    body.attribution.updatedAt = msToSeconds(body.attribution.updatedAt);

    const assetFiles: Record<string, string> = {};
    let moduleRisum: string | undefined;
    for (const [path, data] of Object.entries(files)) {
      if (path === "card.json") continue;
      if (path === "module.risum") {
        moduleRisum = b64(data);
        continue;
      }
      assetFiles[path] = b64(data);
    }

    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(card.data.name),
      body,
      escrow: {
        risu: {
          raw: card,
          unmapped: {
            assetFiles,
            moduleRisum,
            hasExecutableContent: hasExecutableContent(card.data, moduleRisum),
            privileged: isPrivileged(card.data),
          },
        },
      },
    };
  },

  fromCanonical(entity: CanonicalCharacter): AdapterOutput {
    const esc = entity.escrow?.risu;
    const card = (esc?.raw ? structuredClone(esc.raw) : baseCard()) as V3Card;

    // Preserve Risu's original millisecond dates: the canonical body carries them in seconds, so
    // restore the raw values after the shared mapping writes its (seconds) versions back.
    const rawCreated = card.data.creation_date;
    const rawModified = card.data.modification_date;
    applyBodyToData(card.data, entity.body);
    if (rawCreated !== undefined) card.data.creation_date = rawCreated;
    if (rawModified !== undefined) card.data.modification_date = rawModified;

    const files: Record<string, Uint8Array> = {
      "card.json": strToU8(JSON.stringify(card, null, 4)),
    };
    const assetFiles = (esc?.unmapped?.["assetFiles"] as Record<string, string> | undefined) ?? {};
    for (const [path, s] of Object.entries(assetFiles)) files[path] = unb64(s);
    const moduleRisum = esc?.unmapped?.["moduleRisum"] as string | undefined;
    if (moduleRisum) files["module.risum"] = unb64(moduleRisum);

    return { bytes: zipSync(files), suggestedExtension: "charx" };
  },
};

export default adapter;
