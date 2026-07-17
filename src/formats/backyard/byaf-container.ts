/**
 * BYAF ZIP container: open, pack, original twin encode/decode. No body mapping.
 */
import { zipSync, strToU8, strFromU8 } from "fflate";
import { CARD_ARCHIVE_BOUNDS, unzipBounded } from "../../core/archive";

export type Rec = Record<string, unknown>;
export const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function safeUnzip(bytes: Uint8Array, only?: string): Record<string, Uint8Array> {
  return unzipBounded(bytes, { bounds: CARD_ARCHIVE_BOUNDS, only });
}

export const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");
export const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

export const mimeFromPath = (p: string): string => {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
};

export interface OpenedByaf {
  manifest: Rec;
  characterPath: string;
  characterDir: string;
  character: Rec;
  scenarios: { path: string; data: Rec }[];
  /** full zip paths -> bytes (for re-pack + images) */
  files: Record<string, Uint8Array>;
}

export function openByaf(bytes: Uint8Array): OpenedByaf | null {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  let files: Record<string, Uint8Array>;
  try {
    files = safeUnzip(bytes);
  } catch {
    return null;
  }
  const manBytes = files["manifest.json"];
  if (!manBytes) return null;
  let manifest: Rec;
  try {
    const m = JSON.parse(strFromU8(manBytes));
    if (!isRec(m)) return null;
    manifest = m;
  } catch {
    return null;
  }
  const charList = Array.isArray(manifest.characters) ? manifest.characters : [];
  const characterPath = typeof charList[0] === "string" ? charList[0] : "";
  if (!characterPath || !files[characterPath]) return null;
  let character: Rec;
  try {
    const c = JSON.parse(strFromU8(files[characterPath]!));
    if (!isRec(c)) return null;
    character = c;
  } catch {
    return null;
  }
  const slash = characterPath.lastIndexOf("/");
  const characterDir = slash >= 0 ? characterPath.slice(0, slash + 1) : "";

  const scenList = Array.isArray(manifest.scenarios) ? manifest.scenarios : [];
  const scenarios: { path: string; data: Rec }[] = [];
  for (const p of scenList) {
    if (typeof p !== "string" || !files[p]) continue;
    try {
      const d = JSON.parse(strFromU8(files[p]!));
      if (isRec(d)) scenarios.push({ path: p, data: d });
    } catch {
      /* skip bad scenario */
    }
  }
  return { manifest, characterPath, characterDir, character, scenarios, files };
}

/** Persist archive twin as JSON-safe original (files as base64). */
export function archiveToOriginal(arc: OpenedByaf): Rec {
  const files: Rec = {};
  for (const [k, v] of Object.entries(arc.files)) {
    files[k] = b64(v);
  }
  return {
    manifest: arc.manifest,
    characterPath: arc.characterPath,
    characterDir: arc.characterDir,
    character: arc.character,
    scenarios: arc.scenarios,
    files,
  };
}

export function originalToArchive(raw: unknown): OpenedByaf | null {
  if (!isRec(raw)) return null;
  const characterPath = str(raw.characterPath);
  const characterDir = str(raw.characterDir) ?? "";
  if (!characterPath || !isRec(raw.character) || !isRec(raw.manifest)) return null;
  const filesIn = isRec(raw.files) ? raw.files : {};
  const files: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(filesIn)) {
    if (typeof v === "string") files[k] = unb64(v);
  }
  const scenariosRaw = Array.isArray(raw.scenarios) ? raw.scenarios : [];
  const scenarios: { path: string; data: Rec }[] = [];
  for (const row of scenariosRaw) {
    if (!isRec(row)) continue;
    const path = str(row.path);
    if (!path || !isRec(row.data)) continue;
    scenarios.push({ path, data: row.data });
  }
  return {
    manifest: raw.manifest,
    characterPath,
    characterDir,
    character: raw.character,
    scenarios,
    files,
  };
}

export function packByaf(arc: OpenedByaf): Uint8Array {
  arc.files["manifest.json"] = strToU8(JSON.stringify(arc.manifest, null, 2));
  arc.files[arc.characterPath] = strToU8(JSON.stringify(arc.character, null, 2));
  for (const sc of arc.scenarios) {
    arc.files[sc.path] = strToU8(JSON.stringify(sc.data, null, 2));
  }
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(arc.files)) {
    if (k.endsWith("/")) continue;
    out[k] = v;
  }
  return zipSync(out);
}

/** Detect-only: load manifest.json entry if present. */
export function readManifestBytes(zipBytes: Uint8Array): Uint8Array | undefined {
  try {
    return safeUnzip(zipBytes, "manifest.json")["manifest.json"];
  } catch {
    return undefined;
  }
}
