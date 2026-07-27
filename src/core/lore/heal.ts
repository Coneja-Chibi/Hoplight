/**
 * Silent lorebook heal for import staging. Codecs already fold primary aliases;
 * this covers leftovers a tolerant reader may pass through + soft coercions.
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import { DEFAULT_SCAN_DEPTH } from "../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "./empty-book";

export interface HealNote {
  path: string;
  message: string;
}

export interface HealResult {
  book: LorebookBody;
  healed: HealNote[];
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asNum = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

/**
 * Heal a partially-decoded or raw-ish book into a safe LorebookBody.
 * Idempotent on a clean body (no notes).
 */
/**
 * Tolerant reader for FOREIGN or damaged lorebook payloads (naked JSON, hand-edited files). It
 * rebuilds the body by enumeration, so it must never run on an adapter-produced canonical body -
 * every canonical field outside its list would silently reset to defaults.
 */
export function healBook(raw: unknown): HealResult {
  const healed: HealNote[] = [];
  const base = emptyLorebookBody("Untitled lorebook");

  if (!isRec(raw)) {
    return {
      book: base,
      healed: [{ path: "", message: "Payload was not an object; started a blank book." }],
    };
  }

  // Nested lorebook / character_book wrappers
  let root = raw;
  if (isRec(raw.lorebook)) {
    root = raw.lorebook as Record<string, unknown>;
    healed.push({ path: "lorebook", message: "Unwrapped nested lorebook object." });
  } else if (isRec(raw.character_book)) {
    root = raw.character_book as Record<string, unknown>;
    healed.push({ path: "character_book", message: "Unwrapped character_book object." });
  }

  const name =
    typeof root.name === "string" && root.name.trim()
      ? root.name.trim()
      : typeof root.comment === "string" && root.comment.trim()
        ? root.comment.trim()
        : base.name;
  if (name === base.name && typeof root.name !== "string") {
    healed.push({ path: "name", message: "Missing name; used Untitled lorebook." });
  }

  const entriesField = root.entries;
  const entriesRaw: unknown[] = Array.isArray(entriesField)
    ? entriesField
    : isRec(entriesField) && Array.isArray(entriesField.entries)
      ? (entriesField.entries as unknown[])
      : [];

  if (!Array.isArray(entriesField)) {
    healed.push({ path: "entries", message: "Entries missing or not a list; started empty." });
  }

  const entries: LorebookEntry[] = [];
  for (let i = 0; i < entriesRaw.length; i++) {
    const er = entriesRaw[i];
    if (!isRec(er)) {
      healed.push({ path: `entries[${i}]`, message: "Skipped a non-object entry." });
      continue;
    }
    const id =
      typeof er.id === "string" && er.id
        ? er.id
        : typeof er.uid === "number" || typeof er.uid === "string"
          ? `e${er.uid}`
          : `e${i + 1}`;
    const e = emptyLoreEntry(id);
    e.title =
      typeof er.title === "string"
        ? er.title
        : typeof er.comment === "string"
          ? er.comment
          : e.title;
    e.content = typeof er.content === "string" ? er.content : e.content;
    e.enabled = er.enabled === false || er.disable === true ? false : true;
    e.constant = asBool(er.constant, false);
    e.probability = Math.max(0, Math.min(100, asNum(er.probability, 100)));
    e.sortOrder = asNum(er.sortOrder ?? er.order ?? er.insertion_order, i * 10);
    e.priority = asNum(er.priority, 100);
    e.sticky = asNum(er.sticky, 0);
    e.cooldown = asNum(er.cooldown, 0);
    e.delay = asNum(er.delay, 0);

    // Prefer already-canonical triggers; else fold legacy keys/key arrays.
    if (Array.isArray(er.triggers) && er.triggers.length > 0) {
      e.triggers = er.triggers
        .filter(isRec)
        .map((t) => ({
          keyword: typeof t.keyword === "string" ? t.keyword : "",
          isRegex: t.isRegex === true,
          ...(typeof t.flags === "string" ? { flags: t.flags } : {}),
        }))
        .filter((t) => t.keyword.length > 0);
    } else {
      const keys = er.keys ?? er.key;
      if (Array.isArray(keys)) {
        e.triggers = keys
          .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
          .map((keyword) => ({ keyword, isRegex: false }));
        healed.push({
          path: `entries[${i}].keys`,
          message: "Folded legacy keys array into triggers.",
        });
      }
    }

    if (Array.isArray(er.secondaryTriggers)) {
      e.secondaryTriggers = er.secondaryTriggers
        .filter(isRec)
        .map((t) => ({
          keyword: typeof t.keyword === "string" ? t.keyword : "",
          isRegex: t.isRegex === true,
        }))
        .filter((t) => t.keyword.length > 0);
    }

    if (typeof er.probability === "string") {
      // `|| 100` here would read a legitimate "0" (never fire on chance) as "always". Only a value
      // that is not a number at all falls back; 0 is a real answer. Empty is absence, not zero:
      // Number("") is 0, so it has to be rejected before parsing rather than after.
      const raw = er.probability.trim();
      const parsed = raw === "" ? Number.NaN : Number(raw);
      e.probability = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 100;
      healed.push({
        path: `entries[${i}].probability`,
        message: "Coerced probability string to a number.",
      });
    }

    entries.push(e);
  }

  const book: LorebookBody = {
    ...base,
    name,
    description: typeof root.description === "string" ? root.description : null,
    tags: Array.isArray(root.tags)
      ? root.tags.filter((t): t is string => typeof t === "string")
      : [],
    enabled: root.enabled === false ? false : true,
    globalCaseSensitive: asBool(root.globalCaseSensitive, false),
    globalMatchWholeWords: asBool(root.globalMatchWholeWords, false),
    globalScanDepth: asNum(root.globalScanDepth ?? root.scanDepth, DEFAULT_SCAN_DEPTH),
    globalRecursion: asBool(root.globalRecursion, false),
    tokenBudget: asNum(root.tokenBudget, 0),
    budgetMode: root.budgetMode === "entry" ? "entry" : "token",
    entryBudget: asNum(root.entryBudget, 0),
    entries: entries.length > 0 ? entries : base.entries,
  };

  return { book, healed };
}
