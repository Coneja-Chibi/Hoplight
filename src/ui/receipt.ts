/**
 * The import RECEIPT humanizer - the plain-words voice of journeys/1.2-import-flow.md, rendered
 * server-side so both shells (visual app, future TUI) say identical sentences. Rules: platform names
 * only (never spec tags), "we read / we kept / we saved" voice, every line only when true. This is a
 * RENDERING of what the engine already knows; no format logic lives here.
 */
import type { CanonicalEntity } from "../core/canonical";
import type { CharacterBody } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { CanonicalRegexSet } from "../entities/regex/schema";

type AnyEntity = CanonicalEntity<string, unknown>;

/** Human platform names per format id (the friendly-name map the import journey called for). */
const FRIENDLY: Record<string, string> = {
  sillytavern: "SillyTavern",
  "sillytavern-lorebook": "SillyTavern",
  risu: "RisuAI",
  "risu-lorebook": "RisuAI",
  rolecall: "RoleCall",
  "rolecall-lorebook": "RoleCall",
  "rolecall-persona": "RoleCall",
  agnai: "Agnai",
  "agnai-lorebook": "Agnai",
  backyard: "Backyard (legacy)",
  byaf: "Backyard",
  "novelai-lorebook": "NovelAI",
  "vaud-json": "Hoplight",
  lumiverse: "Lumiverse",
  pygmalion: "Pygmalion",
  "sillytavern-regex": "SillyTavern",
  "risu-regex": "RisuAI",
  "rolecall-regex": "RoleCall",
  "lumiverse-regex": "Lumiverse",
  "marinara-regex": "Marinara",
  "marinara-lorebook": "Marinara",
  "marinara-preset": "Marinara",
  "sillytavern-preset": "SillyTavern (RoleCall exports too)",
  "sillytavern-persona": "SillyTavern",
  "lumiverse-persona": "Lumiverse",
  "marinara-persona": "Marinara",
};

export const friendlyFormat = (formatId: string): string => FRIENDLY[formatId] ?? formatId;

const KIND_WORD: Record<string, string> = {
  character: "character card",
  lorebook: "lorebook",
  persona: "persona",
  regex: "regex set",
  preset: "preset",
};

export interface Receipt {
  name: string;
  /** "A character card, made for SillyTavern." */
  kindLine: string;
  /** only-when-true extra lines (embedded book, scripts, privileged) */
  extras: string[];
}

/**
 * @param relatedLorebooks - books already extracted by inspectBundle (same pass as the entity).
 *   When provided, the receipt describes those books rather than re-extracting from original.
 */
export function buildReceipt(
  entity: AnyEntity,
  formatId: string,
  relatedLorebooks?: CanonicalLorebook[],
  relatedRegexSets?: CanonicalRegexSet[],
): Receipt {
  const kindWord = KIND_WORD[entity.kind] ?? entity.kind;
  const platform = friendlyFormat(formatId);
  const article = /^[aeiou]/i.test(kindWord) ? "An" : "A";
  const extras: string[] = [];

  if (entity.kind === "character") {
    const body = entity.body as CharacterBody;
    const books = relatedLorebooks ?? [];
    if (books.length > 0) {
      const entries = books[0]!.body.entries.length;
      extras.push(
        `It brought its own lorebook (${entries} ${
          entries === 1 ? "entry" : "entries"
        }) - we kept them together.`,
      );
    }
    const b = body.behavior;
    const scriptCount = (b?.regexScripts?.length ?? 0) + (b?.triggerScripts?.length ?? 0);
    if (scriptCount > 0 || b?.virtualScript || b?.backgroundHTML) {
      extras.push("It carries scripts. They are saved as text and will never run unless you put them on the test stage.");
    }
    if (b?.privileged) extras.push("It asks for deep access - we do not grant that.");
  }
  if (entity.kind === "persona") {
    extras.push("That is you, not a character - we shelve it with your personas.");
  }
  if (entity.kind === "preset") {
    const sets = relatedRegexSets ?? [];
    if (sets.length > 0) {
      const rules = sets.reduce((n, s) => n + s.body.rules.length, 0);
      extras.push(
        `It bundles ${rules} regex ${rules === 1 ? "script" : "scripts"} - they shelve beside it as their own set.`,
      );
    }
  }

  const name =
    entity.kind === "character"
      ? ((entity.body as CharacterBody).identity?.name ?? entity.id)
      : (((entity.body as { name?: string }).name || entity.id) as string);

  return { name, kindLine: `${article} ${kindWord}, made for ${platform}.`, extras };
}

/** The warm unknown-file line (journey 1.2): states what we DID look for, one next step implied. */
export const UNKNOWN_FILE_MESSAGE =
  "We could not read this one. It is not a card, book, or persona format we know yet. " +
  "We looked for: png, json, charx, lorebook, byaf.";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Name a file we RECOGNIZE but cannot import, in plain words. Detection refuses these shapes on
 * purpose (the cross-kind firewall); telling the user "unknown file" about a famous preset reads
 * as a bug, so the refusal says what the file is and what works instead. Tolerant reader: anything
 * unrecognized returns null and the generic line stands.
 */
export function unsupportedShapeLine(text: string | undefined): string | null {
  if (!text) return null;
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRec(o)) return null;
  // ST/RC completion presets import for real now (the sillytavern-preset codec claims them);
  // only the still-unsupported settings shapes get named refusals here.
  if ("input_sequence" in o && "output_sequence" in o) {
    return "This is a SillyTavern instruct template. Hoplight cannot import those yet.";
  }
  if ("story_string" in o) {
    return "This is a SillyTavern context template. Hoplight cannot import those yet.";
  }
  if (typeof o.type === "string" && "exportedAt" in o && isRec(o.data)) {
    return `This is a RoleCall library export of a ${o.type}. Hoplight cannot import these yet.`;
  }
  return null;
}
