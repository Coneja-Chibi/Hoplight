/**
 * Backyard Archive Format (.byaf) - ZIP: manifest.json, characters/<id>/character.json,
 * scenarios/<n>.json, and images. Spec: ahoylabs/byaf (MIT). Samples: samples/backyard/1-3.byaf.
 * Authored character content maps to body; sampling, chat transcript, grammar stay on original.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalCharacter,
  CharacterBody,
  Greeting,
  MediaAsset,
} from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { strFromU8 } from "fflate";
import coverage from "./byaf-coverage";
import {
  type OpenedByaf,
  type Rec,
  archiveToOriginal,
  b64,
  isRec,
  mimeFromPath,
  openByaf,
  originalToArchive,
  packByaf,
  readManifestBytes,
  str,
  unb64,
} from "./byaf-container";
import { applyGreetingsToArchive, mintGreetingId } from "./byaf-scenarios";

/** ISO / date string -> unix seconds for attribution. */
const isoToUnix = (v: unknown): number | undefined => {
  if (typeof v !== "string" || !v) return undefined;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
};

function textMsgs(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const row of arr) {
    if (!isRec(row)) continue;
    const t = str(row.text);
    if (t) out.push(t);
  }
  return out;
}

function archiveToBody(arc: OpenedByaf): CharacterBody {
  const ch = arc.character;
  const primary = arc.scenarios[0]?.data ?? {};
  const displayName = str(ch.displayName) ?? str(ch.name) ?? "";
  const shortName = str(ch.name);
  const primaryPath = arc.scenarios[0]?.path ?? "scenarios/scenario1.json";
  const firsts = textMsgs(primary.firstMessages);
  const alts: Greeting[] = firsts.slice(1).map((text, i) => ({
    text,
    id: mintGreetingId(primaryPath, i + 1),
  }));
  for (let i = 1; i < arc.scenarios.length; i++) {
    const entry = arc.scenarios[i]!;
    const sc = entry.data;
    const narrative = (str(sc.narrative) ?? "").trim();
    const scTitle = (str(sc.title) ?? "").trim();
    const title = narrative || scTitle || undefined;
    const t = textMsgs(sc.firstMessages)[0];
    if (t) {
      alts.push({
        text: t,
        ...(title !== undefined ? { title } : {}),
        id: mintGreetingId(entry.path),
      });
    }
  }
  const examples = textMsgs(primary.exampleMessages);

  let portrait: MediaAsset | undefined;
  const assets: MediaAsset[] = [];
  const images = Array.isArray(ch.images) ? ch.images : [];
  for (const img of images) {
    if (!isRec(img)) continue;
    const rel = str(img.path);
    if (!rel) continue;
    const full = `${arc.characterDir}${rel}`.replace(/\\/g, "/");
    const bytes = arc.files[full];
    if (!bytes) continue;
    const label = str(img.label) ?? "";
    const mime = mimeFromPath(rel);
    const asset: MediaAsset = {
      role: label.toLowerCase() === "avatar" || !portrait ? "portrait" : "other",
      label: label || undefined,
      ref: `data:${mime};base64,${b64(bytes)}`,
      mime,
      primary: label.toLowerCase() === "avatar" || !portrait,
    };
    if (asset.role === "portrait" && !portrait) portrait = asset;
    else assets.push({ ...asset, role: "other", primary: false });
  }

  const bgPath = str(primary.backgroundImage);
  let background: { ref: string } | undefined;
  if (bgPath && arc.files[bgPath]) {
    const mime = mimeFromPath(bgPath);
    background = {
      ref: `data:${mime};base64,${b64(arc.files[bgPath]!)}`,
    };
  }

  const author = isRec(arc.manifest.author) ? arc.manifest.author : {};
  const nsfw = ch.isNSFW === true;

  return {
    identity: {
      name: displayName,
      nickname: shortName && shortName !== displayName ? shortName : undefined,
      description: str(ch.persona),
    },
    persona: {
      scenario: str(primary.narrative),
    },
    prompts: {
      systemPrompt: str(primary.formattingInstructions),
    },
    greetings: {
      firstMessage: firsts[0],
      alternateGreetings: alts.length > 0 ? alts : undefined,
    },
    examples: {
      exampleMessages: examples.length > 0 ? examples.join("\n") : undefined,
    },
    media: {
      portrait,
      assets: assets.length > 0 ? assets : undefined,
    },
    presentation: background ? { background } : undefined,
    attribution: {
      creator: str(author.name),
      sourceUrl: str(author.backyardURL),
      createdAt: isoToUnix(ch.createdAt) ?? isoToUnix(arc.manifest.createdAt),
      updatedAt: isoToUnix(ch.updatedAt),
    },
    discovery: {
      rating: nsfw ? "explicit" : "all-ages",
    },
  };
}

/** data: URI -> mime + bytes. Non-data refs (http, paths) return null; leave twin files alone. */
function parseDataUri(ref: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)?(?:;charset=[^;,]*)?;base64,([\s\S]+)$/i.exec(ref);
  if (!m) return null;
  try {
    return { mime: (m[1] ?? "application/octet-stream").trim(), bytes: unb64(m[2]!) };
  } catch {
    return null;
  }
}

const extForMime = (mime: string): string => {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "bin";
};

/**
 * Write portrait + gallery + scenario background from body data URIs into the archive files map.
 * Unedited re-open produces data URIs, so rewrite is safe; http/path refs are skipped (twin wins).
 */
function applyMediaToArchive(arc: OpenedByaf, b: CharacterBody): void {
  const ch = arc.character;
  const dir = arc.characterDir;
  const portrait = b.media.portrait;
  const assets = b.media.assets ?? [];
  const prevImages = Array.isArray(ch.images) ? ch.images : [];
  // A row whose file exists in the archive round-tripped through canonical, so canonical emptiness
  // there means the user cleared it. Rows pointing at missing files never reached canonical: they are
  // twin residue, and their absence from canonical says nothing.
  const resolvableRow = (row: unknown): boolean =>
    isRec(row) && !!str(row.path) && !!arc.files[`${dir}${str(row.path)}`.replace(/\\/g, "/")];
  if (portrait === undefined && assets.length === 0) {
    if (prevImages.some(resolvableRow)) {
      const prefix = `${dir}images/`;
      for (const k of Object.keys(arc.files)) {
        if (k.startsWith(prefix) && !k.endsWith("/")) delete arc.files[k];
      }
      ch.images = [];
    }
  } else {
    const rows: Rec[] = [];
    const keep = new Set<string>();

    const pathForLabel = (label: string, fallbackBase: string, mime: string): string => {
      const want = label.toLowerCase();
      for (const row of prevImages) {
        if (!isRec(row)) continue;
        const lbl = (str(row.label) ?? "").toLowerCase();
        if (lbl === want && str(row.path)) return str(row.path)!;
      }
      return `images/${fallbackBase}.${extForMime(mime)}`;
    };

    const pushAsset = (asset: MediaAsset, defaultLabel: string, fallbackBase: string): void => {
      const parsed = parseDataUri(asset.ref);
      if (!parsed) return;
      const label = (asset.label?.trim() || defaultLabel).trim();
      const rel = pathForLabel(label, fallbackBase, parsed.mime);
      const full = `${dir}${rel}`.replace(/\\/g, "/");
      arc.files[full] = parsed.bytes;
      keep.add(full);
      rows.push({ path: rel, label });
    };

    if (portrait) pushAsset(portrait, "avatar", "avatar");
    let i = 0;
    for (const a of assets) {
      i += 1;
      const base = (a.label?.trim() || `image${i}`).replace(/[^\w.-]+/g, "_") || `image${i}`;
      pushAsset(a, a.label?.trim() || "", base);
    }

    if (rows.length > 0) {
      const prefix = `${dir}images/`;
      for (const k of Object.keys(arc.files)) {
        if (k.startsWith(prefix) && !k.endsWith("/") && !keep.has(k)) delete arc.files[k];
      }
      ch.images = rows;
    }
  }

  const primary = arc.scenarios[0]?.data;
  const bgRef = b.presentation?.background?.ref;
  if (primary && typeof bgRef === "string" && bgRef.length > 0) {
    const parsed = parseDataUri(bgRef);
    if (parsed) {
      const existing = str(primary.backgroundImage);
      const path =
        existing && existing.length > 0
          ? existing
          : `scenarios/background.${extForMime(parsed.mime)}`;
      arc.files[path] = parsed.bytes;
      primary.backgroundImage = path;
    }
  } else if (primary) {
    // Cleared background. Same round-trip test as images: only a backgroundImage whose file exists
    // in the archive ever reached canonical, so only that one is the user's to clear. The file goes
    // too, unless another scenario still points at it.
    const existing = str(primary.backgroundImage);
    if (existing && existing.length > 0 && arc.files[existing]) {
      const sharedElsewhere = arc.scenarios
        .slice(1)
        .some((s) => str(s.data.backgroundImage) === existing);
      if (!sharedElsewhere) delete arc.files[existing];
      delete primary.backgroundImage;
    }
  }
}

function applyBodyToArchive(arc: OpenedByaf, b: CharacterBody): void {
  const ch = arc.character;
  const cid = str(ch.id) ?? "character";
  ch.displayName = b.identity.name;
  ch.name = b.identity.nickname ?? b.identity.name;
  if (b.identity.description !== undefined) ch.persona = b.identity.description;
  if (b.discovery.rating === "explicit") ch.isNSFW = true;
  else if (b.discovery.rating === "all-ages") ch.isNSFW = false;

  applyGreetingsToArchive(arc, b, cid);

  const author = isRec(arc.manifest.author) ? { ...arc.manifest.author } : {};
  if (b.attribution.creator !== undefined) author.name = b.attribution.creator;
  if (b.attribution.sourceUrl !== undefined) author.backyardURL = b.attribution.sourceUrl;
  if (Object.keys(author).length > 0) arc.manifest.author = author;

  applyMediaToArchive(arc, b);
}

const byafAdapter: CharacterAdapter = {
  id: "byaf",
  label: "Backyard archive (.byaf)",
  outputExtensions: ["byaf"],
  kind: "character",
  coverage,

  detect(input: AdapterInput): number {
    if (!input.bytes || input.bytes[0] !== 0x50 || input.bytes[1] !== 0x4b) return 0;
    try {
      const man = readManifestBytes(input.bytes);
      if (!man) return 0;
      const m = JSON.parse(strFromU8(man));
      if (!isRec(m)) return 0;
      if (!Array.isArray(m.characters) || !Array.isArray(m.scenarios)) return 0;
      if (typeof m.characters[0] !== "string") return 0;
      return 1;
    } catch {
      return 0;
    }
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    if (!input.bytes) throw new Error("byaf: needs zip bytes");
    const arc = openByaf(input.bytes);
    if (!arc) throw new Error("byaf: not a valid Backyard .byaf archive");
    const body = archiveToBody(arc);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(body.identity.name || str(arc.character.id)),
      body,
      original: { byaf: { raw: archiveToOriginal(arc) } },
    };
  },

  fromCanonical(entity: CanonicalCharacter): AdapterOutput {
    const twin = originalToArchive(entity.original?.byaf?.raw);
    if (!twin) {
      const id = entity.id || "character";
      const charPath = `characters/${id}/character.json`;
      const scenPath = "scenarios/scenario1.json";
      const character: Rec = {
        schemaVersion: 1,
        id,
        name: entity.body.identity.nickname ?? entity.body.identity.name,
        displayName: entity.body.identity.name,
        isNSFW: entity.body.discovery.rating === "explicit",
        persona: entity.body.identity.description ?? "",
        loreItems: [],
        images: [],
      };
      const scenario: Rec = {
        schemaVersion: 1,
        formattingInstructions: entity.body.prompts.systemPrompt ?? "",
        narrative: entity.body.persona.scenario ?? "",
        firstMessages: entity.body.greetings.firstMessage
          ? [{ characterID: id, text: entity.body.greetings.firstMessage }]
          : [],
        exampleMessages: [],
        messages: [],
      };
      const manifest: Rec = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        characters: [charPath],
        scenarios: [scenPath],
        author: {
          name: entity.body.attribution.creator,
          backyardURL: entity.body.attribution.sourceUrl,
        },
      };
      const arc: OpenedByaf = {
        manifest,
        characterPath: charPath,
        characterDir: `characters/${id}/`,
        character,
        scenarios: [{ path: scenPath, data: scenario }],
        files: {},
      };
      applyBodyToArchive(arc, entity.body);
      return { bytes: packByaf(arc), suggestedExtension: "byaf" };
    }
    applyBodyToArchive(twin, entity.body);
    return { bytes: packByaf(twin), suggestedExtension: "byaf" };
  },
};

export { byafAdapter };
export default byafAdapter;
