/**
 * The import RECEIPT humanizer - the plain-words voice of journeys/1.2-import-flow.md, rendered
 * server-side so both shells (visual app, future TUI) say identical sentences. Rules: platform names
 * only (never spec tags), "we read / we kept / we saved" voice, every line only when true. This is a
 * RENDERING of what the engine already knows; no format logic lives here.
 */
import type { CanonicalEntity } from "../core/canonical";
import { primaryEscrowRaw } from "../core/canonical";
import { extractCharacterBook } from "../formats/_shared/character-book";
import type { CharacterBody } from "../entities/character/schema";

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
  backyard: "Backyard",
  "novelai-lorebook": "NovelAI",
  "vaud-json": "Vaude",
};

export const friendlyFormat = (formatId: string): string => FRIENDLY[formatId] ?? formatId;

const KIND_WORD: Record<string, string> = {
  character: "character card",
  lorebook: "lorebook",
  persona: "persona",
};

export interface Receipt {
  name: string;
  /** "A character card, made for SillyTavern." */
  kindLine: string;
  /** only-when-true extra lines (embedded book, scripts, privileged) */
  extras: string[];
}

export function buildReceipt(entity: AnyEntity, formatId: string): Receipt {
  const kindWord = KIND_WORD[entity.kind] ?? entity.kind;
  const platform = friendlyFormat(formatId);
  const article = /^[aeiou]/i.test(kindWord) ? "An" : "A";
  const extras: string[] = [];

  if (entity.kind === "character") {
    const body = entity.body as CharacterBody;
    const embedded = extractCharacterBook(primaryEscrowRaw(entity.escrow));
    if (embedded && embedded.body.entries.length > 0) {
      extras.push(
        `It brought its own lorebook (${embedded.body.entries.length} ${
          embedded.body.entries.length === 1 ? "entry" : "entries"
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
