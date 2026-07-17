/**
 * Lumiverse modules sidecar (lumiverse_modules.json in a charx-like ZIP).
 * Pure rehydrate / pack helpers: map archive paths to data URIs, merge into
 * data.extensions, rebuild modules for re-export. Spec from clone
 * character-export.service.ts (facts only).
 */
import type { MediaAsset } from "../../entities/character/schema";
import type { RegexRule } from "../../entities/regex/schema";
import {
  decodeLumiverseModuleRegexScripts,
  encodeLumiverseModuleRegexScripts,
} from "./regex";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const MAX_ASSET = 64 * 1024 * 1024;

export interface LumiModules {
  version?: number;
  expressions?: {
    enabled?: boolean;
    defaultExpression?: string;
    mappings?: Record<string, string>;
  };
  expression_groups?: {
    groups?: Record<string, Record<string, string>>;
  };
  alternate_fields?: Rec;
  alternate_avatars?: Array<{ id?: string; label?: string; path?: string; image_id?: string }>;
  has_nsfw_expressions?: boolean;
  world_books?: unknown[];
  regex_scripts?: unknown[];
}

const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");
const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

export const mimeFromPath = (p: string): string => {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
};

export const isDataUri = (s: string): boolean => /^data:/i.test(s);

/** Resolve archive path or pass through data URI; missing files stay as original ref. */
export function resolveAssetRef(ref: string, files: Record<string, Uint8Array>): string {
  if (!ref || isDataUri(ref)) return ref;
  const bytes = files[ref] ?? files[ref.replace(/^\//, "")];
  if (!bytes || bytes.length > MAX_ASSET) return ref;
  const mime = mimeFromPath(ref);
  return `data:${mime};base64,${b64(bytes)}`;
}

export function hydrateStringMap(
  map: Record<string, string> | undefined,
  files: Record<string, Uint8Array>,
): Record<string, string> {
  if (!map) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string") out[k] = resolveAssetRef(v, files);
  }
  return out;
}

/**
 * Merge modules into card data.extensions and collect media assets for the body.
 * Mutates a clone of data; does not touch files.
 */
export function rehydrateCardData(
  dataIn: Rec,
  modules: LumiModules | null,
  files: Record<string, Uint8Array>,
): { data: Rec; extraAssets: MediaAsset[] } {
  const data = structuredClone(dataIn) as Rec;
  const ext: Rec = isRec(data.extensions) ? { ...data.extensions } : {};
  const extraAssets: MediaAsset[] = [];

  if (!modules) {
    // Still hydrate any data-URI-less paths already on extensions if files exist
    hydrateExtensionsInPlace(ext, files, extraAssets);
    data.extensions = ext;
    return { data, extraAssets };
  }

  if (modules.expressions && typeof modules.expressions === "object") {
    const mappings = hydrateStringMap(
      isRec(modules.expressions.mappings)
        ? (modules.expressions.mappings as Record<string, string>)
        : undefined,
      files,
    );
    ext.expressions = {
      enabled: modules.expressions.enabled === true,
      defaultExpression: modules.expressions.defaultExpression ?? "",
      mappings,
    };
    for (const [label, ref] of Object.entries(mappings)) {
      if (isDataUri(ref)) {
        extraAssets.push({ role: "emotion", label, ref, mime: ref.slice(5, ref.indexOf(";")) || undefined });
      }
    }
  }

  if (modules.expression_groups && isRec(modules.expression_groups.groups)) {
    const groupsIn = modules.expression_groups.groups as Rec;
    const groupsOut: Rec = {};
    for (const [charName, labels] of Object.entries(groupsIn)) {
      if (!isRec(labels)) continue;
      const map: Record<string, string> = {};
      for (const [lab, path] of Object.entries(labels)) {
        if (typeof path === "string") {
          map[lab] = resolveAssetRef(path, files);
          if (isDataUri(map[lab]!)) {
            extraAssets.push({
              role: "emotion",
              label: `${charName}:${lab}`,
              ref: map[lab]!,
              mime: mimeFromPath(path),
            });
          }
        }
      }
      groupsOut[charName] = map;
    }
    ext.expression_groups = groupsOut;
  }

  if (modules.alternate_fields && isRec(modules.alternate_fields)) {
    ext.alternate_fields = structuredClone(modules.alternate_fields);
  }

  if (Array.isArray(modules.alternate_avatars)) {
    const avatars: Rec[] = [];
    for (const row of modules.alternate_avatars) {
      if (!isRec(row)) continue;
      const path = str(row.path) ?? str(row.image_id) ?? "";
      const ref = path ? resolveAssetRef(path, files) : "";
      const label = str(row.label) ?? str(row.id) ?? "avatar";
      const id = str(row.id) ?? label;
      avatars.push({ id, label, image_id: ref, path: ref });
      if (isDataUri(ref)) {
        extraAssets.push({ role: "other", label, ref, mime: mimeFromPath(path) });
      }
    }
    if (avatars.length) ext.alternate_avatars = avatars;
  }

  if (Array.isArray(modules.world_books) && modules.world_books.length > 0) {
    ext._lumiverse_modules_world_books = modules.world_books;
  }
  if (Array.isArray(modules.regex_scripts) && modules.regex_scripts.length > 0) {
    // Unseal through the codec (canonical RegexRule[], not an opaque blob) - REGEX-JEWEL-PLAN.md R1.
    ext._lumiverse_modules_regex_scripts = decodeLumiverseModuleRegexScripts(modules.regex_scripts);
  }

  hydrateExtensionsInPlace(ext, files, extraAssets);
  data.extensions = ext;
  return { data, extraAssets };
}

/** Hydrate image_id / path fields already on extensions when archive files exist. */
function hydrateExtensionsInPlace(
  ext: Rec,
  files: Record<string, Uint8Array>,
  extraAssets: MediaAsset[],
): void {
  if (isRec(ext.expressions) && isRec(ext.expressions.mappings)) {
    const m = hydrateStringMap(ext.expressions.mappings as Record<string, string>, files);
    ext.expressions = { ...ext.expressions, mappings: m };
    for (const [label, ref] of Object.entries(m)) {
      if (isDataUri(ref)) extraAssets.push({ role: "emotion", label, ref });
    }
  }
  if (Array.isArray(ext.alternate_avatars)) {
    ext.alternate_avatars = (ext.alternate_avatars as unknown[]).map((row) => {
      if (!isRec(row)) return row;
      const path = str(row.path) ?? str(row.image_id) ?? "";
      if (!path || isDataUri(path)) return row;
      const ref = resolveAssetRef(path, files);
      if (isDataUri(ref)) {
        extraAssets.push({ role: "other", label: str(row.label) ?? "avatar", ref });
        return { ...row, image_id: ref, path: ref };
      }
      return row;
    });
  }
}

/**
 * Build modules sidecar from extensions (for re-pack). Data-URI mappings get written to files map
 * under stable archive paths; mappings in modules point at those paths.
 */
export function packModulesFromExtensions(
  extIn: unknown,
  files: Record<string, Uint8Array>,
): { modules: LumiModules | null; files: Record<string, Uint8Array> } {
  if (!isRec(extIn)) return { modules: null, files };
  const ext = extIn;
  const nextFiles = { ...files };
  const modules: LumiModules = { version: 1 };
  let any = false;

  if (isRec(ext.expressions)) {
    const mappingsIn = isRec(ext.expressions.mappings)
      ? (ext.expressions.mappings as Record<string, string>)
      : {};
    const mappings: Record<string, string> = {};
    for (const [label, ref] of Object.entries(mappingsIn)) {
      mappings[label] = materializeToArchive(ref, `assets/other/image/expr_${sanitize(label)}`, nextFiles);
    }
    modules.expressions = {
      enabled: ext.expressions.enabled === true,
      defaultExpression: str(ext.expressions.defaultExpression) ?? "",
      mappings,
    };
    any = true;
  }

  if (isRec(ext.expression_groups)) {
    const groupsOut: Record<string, Record<string, string>> = {};
    for (const [charName, labels] of Object.entries(ext.expression_groups)) {
      if (!isRec(labels)) continue;
      const map: Record<string, string> = {};
      for (const [lab, ref] of Object.entries(labels)) {
        if (typeof ref !== "string") continue;
        map[lab] = materializeToArchive(
          ref,
          `assets/other/image/exprg_${sanitize(charName)}--${sanitize(lab)}`,
          nextFiles,
        );
      }
      if (Object.keys(map).length) groupsOut[charName] = map;
    }
    if (Object.keys(groupsOut).length) {
      modules.expression_groups = { groups: groupsOut };
      any = true;
    }
  }

  if (isRec(ext.alternate_fields)) {
    const hasAny = Object.values(ext.alternate_fields).some((a) => Array.isArray(a) && a.length > 0);
    if (hasAny) {
      modules.alternate_fields = structuredClone(ext.alternate_fields) as Rec;
      any = true;
    }
  }

  if (Array.isArray(ext.alternate_avatars) && ext.alternate_avatars.length > 0) {
    const avatars: Array<{ id: string; label: string; path: string }> = [];
    for (const row of ext.alternate_avatars) {
      if (!isRec(row)) continue;
      const id = str(row.id) ?? str(row.label) ?? "avatar";
      const label = str(row.label) ?? id;
      const ref = str(row.image_id) ?? str(row.path) ?? "";
      if (!ref) continue;
      const path = materializeToArchive(ref, `assets/icon/image/${sanitize(id)}`, nextFiles);
      avatars.push({ id, label, path });
    }
    if (avatars.length) {
      modules.alternate_avatars = avatars;
      any = true;
    }
  }

  if (Array.isArray(ext._lumiverse_modules_world_books) && ext._lumiverse_modules_world_books.length) {
    modules.world_books = ext._lumiverse_modules_world_books as unknown[];
    any = true;
  }
  if (Array.isArray(ext._lumiverse_modules_regex_scripts) && ext._lumiverse_modules_regex_scripts.length) {
    // Re-seal through the codec: an untouched decode->encode round trip reproduces the original
    // wire byte-equal (the lossless-escrow doctrine covers every unmapped field via extras).
    modules.regex_scripts = encodeLumiverseModuleRegexScripts(
      ext._lumiverse_modules_regex_scripts as RegexRule[],
    );
    any = true;
  }

  return { modules: any ? modules : null, files: nextFiles };
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-.]+/g, "_").slice(0, 64) || "asset";
}

function materializeToArchive(
  ref: string,
  basePathNoExt: string,
  files: Record<string, Uint8Array>,
): string {
  if (!isDataUri(ref)) {
    // already an archive path or host id - keep if file exists, else keep ref
    if (files[ref]) return ref;
    return ref;
  }
  const m = /^data:([^;,]+)?(?:;charset=[^;,]*)?;base64,([\s\S]+)$/i.exec(ref);
  if (!m) return ref;
  const mime = (m[1] ?? "application/octet-stream").trim();
  const ext =
    mime.includes("png") ? "png" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "bin";
  const path = `${basePathNoExt}.${ext}`;
  try {
    files[path] = unb64(m[2]!);
  } catch {
    return ref;
  }
  return path;
}

/** True if extensions bag looks Lumiverse-authored. */
export function hasLumiverseFingerprints(ext: unknown): boolean {
  if (!isRec(ext)) return false;
  return (
    isRec(ext.expressions) ||
    isRec(ext.expression_groups) ||
    isRec(ext.alternate_fields) ||
    Array.isArray(ext.alternate_avatars) ||
    isRec(ext.lumiverse_image_gen_lora) ||
    typeof ext.alternate_character_name === "string" ||
    Array.isArray(ext.world_book_ids) ||
    Array.isArray(ext.databank_ids) ||
    ext.ttsVoice !== undefined
  );
}

export function parseModulesJson(text: string): LumiModules | null {
  try {
    const j = JSON.parse(text) as unknown;
    return isRec(j) ? (j as LumiModules) : null;
  } catch {
    return null;
  }
}
