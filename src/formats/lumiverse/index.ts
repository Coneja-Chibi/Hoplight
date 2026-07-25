/**
 * Lumiverse character adapter: ST CCv2/v3 JSON/PNG + charx-like ZIP with lumiverse_modules.json.
 * Shared Tavern body mapping; modules rehydrate into data.extensions + media assets (data URIs).
 * Platforms/lumiverse.ts reads original.sillytavern.raw.data.extensions.*.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter, MediaAsset } from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { embedCharacterBook } from "../_shared/character-book";
import { readCardJson } from "../_shared/card-io";
import { assetsToMedia, applyMediaToTavernData } from "../_shared/assets";
import { getVersion, pngSourceMedia } from "../_shared/png";
import {
  type TavernData,
  dataToBody,
  applyBodyToData,
  wrapV2,
  wrapV3,
  CARD_SPEC_V2,
  CARD_SPEC_V3,
} from "../_shared/tavern-fields";
import { zipSync, strToU8, strFromU8 } from "fflate";
import { CARD_ARCHIVE_BOUNDS, unzipBounded } from "../../core/archive";
import coverage from "./coverage";
import {
  hasLumiverseFingerprints,
  parseModulesJson,
  rehydrateCardData,
  packModulesFromExtensions,
  type LumiModules,
} from "./modules";
import { applyAltsToBody, applyVariantsToExtensions } from "./variants-bridge";
import { regexAdapter } from "./regex";
import personaCodec from "./persona";
import presetCodec from "./preset";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");
const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

function safeUnzip(bytes: Uint8Array, only?: string): Record<string, Uint8Array> {
  return unzipBounded(bytes, { bounds: CARD_ARCHIVE_BOUNDS, only });
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function detectCard(json: unknown): { card: Rec; data: TavernData; variant: "v2" | "v3" | "flat" } | null {
  if (!isRec(json)) return null;
  if (json.spec === CARD_SPEC_V3 && isRec(json.data)) {
    return { card: json, data: json.data as TavernData, variant: "v3" };
  }
  if (json.spec === CARD_SPEC_V2 && isRec(json.data)) {
    return { card: json, data: json.data as TavernData, variant: "v2" };
  }
  if (typeof json.name === "string" && (json.extensions !== undefined || json.description !== undefined)) {
    return { card: json, data: json as TavernData, variant: "flat" };
  }
  return null;
}

function mergeMedia(
  fromAssets: ReturnType<typeof assetsToMedia>,
  extra: MediaAsset[],
): CanonicalCharacter["body"]["media"] {
  const media = { ...fromAssets };
  const assets = [...(media.assets ?? []), ...extra.filter((a) => a.role !== "portrait")];
  if (assets.length) media.assets = assets;
  return media;
}

const adapter: CharacterAdapter = {
  id: "lumiverse",
  label: "Lumiverse character (ST + modules)",
  outputExtensions: ["json", "charx"],
  kind: "character",
  coverage,

  detect(input: AdapterInput): number {
    if (input.bytes && isZip(input.bytes)) {
      try {
        const mod = safeUnzip(input.bytes, "lumiverse_modules.json")["lumiverse_modules.json"];
        if (mod) return 1;
        // Prefer Risu for module.risum; do not claim bare charx without modules
        const risum = safeUnzip(input.bytes, "module.risum")["module.risum"];
        if (risum) return 0;
        const card = safeUnzip(input.bytes, "card.json")["card.json"];
        if (card) {
          const j = JSON.parse(strFromU8(card));
          const det = detectCard(j);
          const ext = det && isRec(det.data.extensions) ? det.data.extensions : {};
          if (hasLumiverseFingerprints(ext)) return 0.96;
        }
      } catch {
        return 0;
      }
      return 0;
    }
    if (input.bytes && getVersion(input.bytes)) {
      const j = readCardJson(input);
      const det = j ? detectCard(j) : null;
      const ext = det && isRec(det.data.extensions) ? det.data.extensions : {};
      return hasLumiverseFingerprints(ext) ? 0.95 : 0;
    }
    const j = readCardJson(input);
    const det = j ? detectCard(j) : null;
    if (!det) return 0;
    const ext = isRec(det.data.extensions) ? det.data.extensions : {};
    return hasLumiverseFingerprints(ext) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    let cardJson: unknown = null;
    let files: Record<string, Uint8Array> = {};
    let modules: LumiModules | null = null;
    let fromZip = false;

    if (input.bytes && isZip(input.bytes)) {
      fromZip = true;
      files = safeUnzip(input.bytes);
      const cardBytes = files["card.json"];
      if (!cardBytes) throw new Error("lumiverse: zip missing card.json");
      cardJson = JSON.parse(strFromU8(cardBytes));
      const modBytes = files["lumiverse_modules.json"];
      if (modBytes) modules = parseModulesJson(strFromU8(modBytes));
    } else {
      cardJson = readCardJson(input);
    }

    const det = detectCard(cardJson);
    if (!det) throw new Error("lumiverse: not a recognizable character card");

    const { data, extraAssets } = rehydrateCardData(det.data as Rec, modules, files);
    let body = dataToBody(data as TavernData);
    const fromCcv3 = assetsToMedia((data as TavernData).assets);
    body.media = mergeMedia(fromCcv3, extraAssets);
    // Lumi alternate_fields / alternate_avatars → body.variants (VariantStrip), not a second UI
    const extForAlts = isRec(data.extensions) ? data.extensions : {};
    body = applyAltsToBody(body, extForAlts);

    // Rebuild card envelope with hydrated data for the twin
    const twinCard =
      det.variant === "flat"
        ? data
        : { ...det.card, data };

    const filesB64: Rec = {};
    for (const [k, v] of Object.entries(files)) {
      if (k.endsWith("/")) continue;
      filesB64[k] = b64(v);
    }

    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(str(data.name) ?? det.data.name),
      body,
      original: {
        sillytavern: {
          raw: twinCard,
          // Preserve flat as flat (not mislabeled v2) so re-emit stays one truthful shape.
          unmapped: { variant: det.variant },
          sourceMedia: fromZip ? undefined : pngSourceMedia(input.bytes),
        },
        lumiverse: {
          raw: {
            modules,
            fromZip,
            files: filesB64,
          },
        },
      },
    };
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const st = entity.original?.sillytavern;
    const lumi = isRec(entity.original?.lumiverse?.raw) ? entity.original!.lumiverse!.raw as Rec : {};
    const variant =
      typeof st?.unmapped?.["variant"] === "string" ? String(st.unmapped["variant"]) : "v3";
    const rawCard = st?.raw as Rec | undefined;

    const base: TavernData =
      rawCard && (variant === "v2" || variant === "v3") && isRec(rawCard.data)
        ? { ...(rawCard.data as TavernData) }
        : rawCard
          ? { ...(rawCard as TavernData) }
          : {};
    applyBodyToData(base, entity.body);
    applyMediaToTavernData(base, entity.body.media, "lumiverse");

    // Preserve extensions from twin (native UI edits write here via originalDraft)
    if (isRec(rawCard?.data) && isRec((rawCard!.data as Rec).extensions)) {
      base.extensions = {
        ...((rawCard!.data as Rec).extensions as Rec),
        ...(isRec(base.extensions) ? base.extensions : {}),
      };
    }
    // body.variants → Lumi alternate_fields / alternate_avatars on the wire
    base.extensions = applyVariantsToExtensions(
      isRec(base.extensions) ? (base.extensions as Rec) : {},
      entity.body,
    );
    if (context?.lorebooks !== undefined) embedCharacterBook(base as Rec, context.lorebooks);

    let outCard: unknown;
    if (rawCard && (variant === "v2" || variant === "v3")) {
      outCard = { ...rawCard, data: base };
    } else if (variant === "v3") outCard = wrapV3(base);
    else if (variant === "flat" || variant === "v1") outCard = base;
    else outCard = wrapV2(base);

    const fromZip = lumi.fromZip === true;
    const filesIn = isRec(lumi.files) ? lumi.files : {};
    const files: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(filesIn)) {
      if (typeof v === "string") files[k] = unb64(v);
    }

    const ext = isRec(base.extensions) ? base.extensions : {};
    const want = (context?.requestedExtension ?? "").replace(/^\.+/, "").toLowerCase();
    // Caller intent wins; else preserve source container (zip twin -> charx, else json).
    const preferZip = want === "charx" || want === "zip" || (want === "" && fromZip);
    const preferJson = want === "json" || (want === "" && !fromZip);

    if (preferZip) {
      const { modules, files: packedFiles } = packModulesFromExtensions(ext, files);
      const zipFiles: Record<string, Uint8Array> = { ...packedFiles };
      zipFiles["card.json"] = strToU8(JSON.stringify(outCard, null, 2));
      if (modules) {
        zipFiles["lumiverse_modules.json"] = strToU8(JSON.stringify(modules, null, 2));
      }
      const out: Record<string, Uint8Array> = {};
      for (const [k, v] of Object.entries(zipFiles)) {
        if (!k.endsWith("/")) out[k] = v;
      }
      return { bytes: zipSync(out), suggestedExtension: "charx" };
    }

    if (preferJson && fromZip) {
      // Module-only archive content must be representable in card data before JSON emit.
      const { modules } = packModulesFromExtensions(ext, files);
      if (modules && Object.keys(modules).length > 0) {
        // If modules still exist as separate archive payload, refuse silent flatten.
        const hasFileRefs = Object.keys(files).some((k) => k !== "card.json" && !k.endsWith("/"));
        if (hasFileRefs) {
          throw new Error(
            "lumiverse: cannot emit .json without losing module archive files; use .charx",
          );
        }
      }
    }

    return { text: JSON.stringify(outCard, null, 2), suggestedExtension: "json" };
  },
};

export { adapter as characterAdapter };

/** Folders-as-schema: this format family exports every codec it provides (character + regex
 * scripts + presets). Was a single-adapter default until the regex codec grew its file home. */
export default [adapter, regexAdapter, personaCodec, presetCodec];
