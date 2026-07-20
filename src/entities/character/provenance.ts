/** Character provenance helpers for preserving creator and source attribution across formats. */
import type { AdapterInput } from "../../core/adapter";

/**
 * Card provenance labeler. Answers two questions about a card without fully parsing it into the
 * canonical model: what FORMAT is it (spec + container), and where is it LIKELY FROM (the app that
 * authored it, when the card carries a tell). Origin is a heuristic over app-namespaced extension
 * blocks - a chara_card_v3 can come from Risu, RoleCall, Chub, or SillyTavern, and the namespace is
 * the fingerprint. Pure and tolerant: never throws, returns "unknown" / no origin on junk input.
 *
 * Extend by adding a row to ORIGIN_RULES; new formats (Wyvern, Crushon, NovelAI) slot in here.
 */

/** The physical wrapper the card arrived in. */
export type CardContainer = "png" | "charx" | "json" | "unknown";

/** The card spec / shape, independent of which app wrote it. */
export type CardFormat =
  | "chara_card_v3"
  | "chara_card_v2"
  | "chara_card_v1"
  | "agnai"
  | "backyard"
  | "unknown";

export interface CardLabel {
  format: CardFormat;
  container: CardContainer;
  /** the app the card was most likely authored in, when it carries a tell; omitted otherwise */
  likelyOrigin?: string;
  /** confidence in likelyOrigin, 0..1 (0 when no origin fingerprint fired) */
  confidence: number;
  /** every fingerprint that fired, for transparency (may include weaker ones the winner outranks) */
  signals: string[];
}

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Card fields to inspect: the envelope root, its `data` body (or the flat card), and `data.extensions`. */
interface CardContext {
  root: Rec;
  data: Rec;
  ext: Rec;
}

function contextOf(card: unknown): CardContext {
  const root = isRecord(card) ? card : {};
  const data = isRecord(root.data) ? root.data : root;
  const ext = isRecord(data.extensions) ? data.extensions : {};
  return { root, data, ext };
}

function detectFormat({ root, data }: CardContext): CardFormat {
  if (root.spec === "chara_card_v3") return "chara_card_v3";
  if (root.spec === "chara_card_v2") return "chara_card_v2";
  // Agnai's native shape: a character with a structured persona + a `greeting` (not `first_mes`).
  if (root.kind === "character" && isRecord(root.persona) && typeof root.greeting === "string") {
    return "agnai";
  }
  // Backyard/Faraday legacy flat shape: its own aiName/aiPersona/customDialogue keys, no spec wrapper.
  if (["aiName", "aiPersona", "aiDisplayName", "customDialogue"].some((k) => typeof root[k] === "string")) {
    return "backyard";
  }
  // Flat V1 card: name + first_mes at top level, no spec wrapper.
  if (typeof data.name === "string" && typeof data.first_mes === "string") return "chara_card_v1";
  return "unknown";
}

interface OriginRule {
  origin: string;
  /** higher wins when several fire; unique app namespaces are strong, structural guesses are weak */
  weight: number;
  signal: string;
  test: (ctx: CardContext) => boolean;
}

/** Ordered by specificity, but selection is by weight so order here is only documentation. */
const ORIGIN_RULES: readonly OriginRule[] = [
  { origin: "RoleCall", weight: 0.98, signal: "extensions.rolecall", test: (c) => isRecord(c.ext.rolecall) },
  { origin: "RisuAI", weight: 0.97, signal: "extensions.risuai", test: (c) => isRecord(c.ext.risuai) },
  {
    origin: "Chub (CharacterHub)",
    weight: 0.9,
    signal: "extensions.chub",
    test: (c) => isRecord(c.ext.chub),
  },
  {
    // Marinara Engine writes its fields flat on extensions (shared/types/character.ts in the
    // engine): rpgStats/nameColor/dialogueColor/boxColor/trackerCardColors are unique to it;
    // backstory alone is too generic to fingerprint on.
    origin: "Marinara Engine",
    weight: 0.9,
    signal: "marinara-extension-fields",
    test: (c) =>
      isRecord(c.ext.rpgStats) ||
      typeof c.ext.nameColor === "string" ||
      typeof c.ext.dialogueColor === "string" ||
      typeof c.ext.boxColor === "string" ||
      typeof c.ext.trackerCardColors === "string",
  },
  {
    origin: "Agnai",
    weight: 0.9,
    signal: "agnai-native-persona",
    test: (c) =>
      isRecord(c.ext.agnai) ||
      (c.root.kind === "character" && isRecord(c.root.persona) && typeof c.root.greeting === "string"),
  },
  {
    origin: "Backyard AI (Faraday)",
    weight: 0.85,
    signal: "backyard-native-fields",
    test: (c) =>
      isRecord(c.ext.backyardai) ||
      typeof c.root.aiName === "string" ||
      typeof c.root.aiPersona === "string" ||
      typeof c.root.basePrompt === "string",
  },
  // Weak structural guess: SillyTavern is the reference editor, so a plain Tavern card carrying only
  // ST's own extension keys (and no app namespace above) was most likely authored there.
  {
    origin: "SillyTavern",
    weight: 0.5,
    signal: "sillytavern-extension-keys",
    test: (c) => ["talkativeness", "depth_prompt", "world", "fav"].some((k) => k in c.ext),
  },
];

/**
 * Label a parsed card object. `container` is supplied by the caller (see sniffContainer), since a
 * parsed object no longer knows how it was wrapped.
 */
export function labelCard(card: unknown, container: CardContainer = "unknown"): CardLabel {
  const ctx = contextOf(card);
  const fired = ORIGIN_RULES.filter((r) => {
    try {
      return r.test(ctx);
    } catch {
      return false;
    }
  });
  const winner = fired.reduce<OriginRule | undefined>(
    (best, r) => (r.weight > (best?.weight ?? -1) ? r : best),
    undefined,
  );
  return {
    format: detectFormat(ctx),
    container,
    likelyOrigin: winner?.origin,
    confidence: winner?.weight ?? 0,
    signals: fired.map((r) => r.signal),
  };
}

const startsWith = (bytes: Uint8Array, magic: readonly number[]): boolean =>
  magic.every((b, i) => bytes[i] === b);

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

/**
 * Sniff the container from raw adapter input, without decoding it. Binary magic wins first; anything
 * else that carries text (a decoded .json read) is json. Bytes are usually present even for json, so
 * a non-png/non-zip byte stream falls through to the text check rather than short-circuiting.
 */
export function sniffContainer(input: AdapterInput): CardContainer {
  if (input.bytes) {
    if (startsWith(input.bytes, PNG_MAGIC)) return "png";
    if (startsWith(input.bytes, ZIP_MAGIC)) return "charx";
  }
  if (typeof input.text === "string") return "json";
  return "unknown";
}
