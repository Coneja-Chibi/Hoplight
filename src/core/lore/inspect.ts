/**
 * Nine-rule lorebook linter. Pure book -> findings; optional fix fns are pure book -> book.
 * Rules that need matching call scanBook / keywordMatches - this module does NOT own a second matcher.
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import { keywordMatches, resolveMatchOpts, scanBook, type ScanLine } from "./activation";

export type LoreFindingRule =
  | "broken-data"
  | "broken-numbering"
  | "duplicate-key"
  | "chance-contradiction"
  | "legacy-leftovers"
  | "key-points-nowhere"
  | "wakes-itself"
  | "never-woken"
  | "never-fires";

export type LoreFinding = {
  rule: LoreFindingRule;
  severity: "problem" | "worth-a-look";
  /** Absent = book-level finding. */
  entryId?: string;
  /** Plain language, no jargon. */
  message: string;
  /** Present = Fix All eligible. */
  fix?: (book: LorebookBody) => LorebookBody;
};

const renumberBySortOrder = (book: LorebookBody): LorebookBody => {
  const sorted = [...book.entries].sort((a, b) => a.sortOrder - b.sortOrder);
  const entries = sorted.map((e, i) => ({ ...e, sortOrder: i * 10 }));
  return { ...book, entries };
};

const resetChanceContradiction = (book: LorebookBody, entryId: string): LorebookBody => ({
  ...book,
  entries: book.entries.map((e) =>
    e.id === entryId ? { ...e, probability: 100 } : e,
  ),
});

const stripSelfWakeKey = (book: LorebookBody, entryId: string): LorebookBody => ({
  ...book,
  entries: book.entries.map((e) => {
    if (e.id !== entryId) return e;
    const opts = resolveMatchOpts(e, book);
    const triggers = e.triggers.filter(
      (t) => !keywordMatches(t, e.content, opts).hit,
    );
    return { ...e, triggers };
  }),
});

/**
 * Inspect a book. Findings ordered worst-first within the caller's grouping responsibility;
 * this returns a flat list in rule priority order.
 */
export function inspectBook(book: LorebookBody): LoreFinding[] {
  const findings: LoreFinding[] = [];
  const entries = Array.isArray(book.entries) ? book.entries : [];

  // 1. broken-data
  for (const e of entries) {
    if (!e.title?.trim() && !e.content?.trim()) {
      findings.push({
        rule: "broken-data",
        severity: "problem",
        entryId: e.id,
        message: `An entry has no title and no content.`,
      });
    }
    for (const t of [...e.triggers, ...e.secondaryTriggers]) {
      if (t.isRegex) {
        try {
          // eslint-disable-next-line no-new
          new RegExp(t.keyword, t.flags ?? "");
        } catch {
          findings.push({
            rule: "broken-data",
            severity: "problem",
            entryId: e.id,
            message: `Entry "${e.title || e.id}" has a broken regex key: ${t.keyword}`,
          });
        }
      }
    }
  }

  // 2. broken-numbering (duplicate sortOrder among enabled, or large gaps after dense ids)
  const orderCounts = new Map<number, string[]>();
  for (const e of entries) {
    const list = orderCounts.get(e.sortOrder) ?? [];
    list.push(e.id);
    orderCounts.set(e.sortOrder, list);
  }
  const dupOrders = [...orderCounts.entries()].filter(([, ids]) => ids.length > 1);
  if (dupOrders.length > 0) {
    findings.push({
      rule: "broken-numbering",
      severity: "worth-a-look",
      message: `Several entries share the same sort order (${dupOrders.length} clash${dupOrders.length === 1 ? "" : "es"}). Fix All renumbers by current order.`,
      fix: renumberBySortOrder,
    });
  }

  // 3. duplicate-key across entries (same primary keyword string, case-insensitive)
  const keyOwners = new Map<string, string[]>();
  for (const e of entries) {
    if (!e.enabled) continue;
    for (const t of e.triggers) {
      const k = t.keyword.trim().toLowerCase();
      if (!k) continue;
      const owners = keyOwners.get(k) ?? [];
      if (!owners.includes(e.id)) owners.push(e.id);
      keyOwners.set(k, owners);
    }
  }
  for (const [key, owners] of keyOwners) {
    if (owners.length < 2) continue;
    for (const id of owners) {
      const title = entries.find((e) => e.id === id)?.title || id;
      findings.push({
        rule: "duplicate-key",
        severity: "worth-a-look",
        entryId: id,
        message: `Entry "${title}" shares the key "${key}" with ${owners.length - 1} other entr${owners.length === 2 ? "y" : "ies"}.`,
      });
    }
  }

  // 4. chance-contradiction: constant (always on) with probability < 100 is confusing
  for (const e of entries) {
    if (e.constant && e.probability < 100) {
      findings.push({
        rule: "chance-contradiction",
        severity: "problem",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" is always-on but only has a ${e.probability}% chance. Fix All sets chance to 100%.`,
        fix: (b) => resetChanceContradiction(b, e.id),
      });
    }
  }

  // 5. legacy-leftovers: metadata bag with known legacy aliases
  for (const e of entries) {
    const meta = e.metadata;
    if (!meta || typeof meta !== "object") continue;
    const legacy = ["keys", "key", "keysecondary", "comment" /* if duplicated */, "uid"].filter(
      (k) => k in meta,
    );
    if (legacy.length > 0) {
      findings.push({
        rule: "legacy-leftovers",
        severity: "worth-a-look",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" still carries old import fields (${legacy.join(", ")}). Safe to ignore if the book already reads correctly.`,
      });
    }
  }

  // 6-8: cross-entry via the shared matcher
  for (const e of entries) {
    if (!e.enabled || e.constant || e.vectorized) continue;
    if (e.triggers.length === 0) continue;

    // 6. key-points-nowhere: no other entry's content matches any of this entry's keys
    //    (and the keys don't look like chat words - we only check other entries)
    const others = entries.filter((o) => o.id !== e.id && o.enabled);
    const opts = resolveMatchOpts(e, book);
    let pointsSomewhere = false;
    for (const t of e.triggers) {
      for (const o of others) {
        if (keywordMatches(t, o.content, opts).hit || keywordMatches(t, o.title, opts).hit) {
          pointsSomewhere = true;
          break;
        }
      }
      if (pointsSomewhere) break;
    }
    // Also "points somewhere" if it can match ordinary chat - we can't know. Flag only when
    // the key ONLY appears to target other entries and none match (orphan recursion intent).
    // Soft: only for entries that prevent nothing and have recursion-related flags, OR always
    // as worth-a-look when zero entry content matches AND secondary keys exist (selective pair).
    if (!pointsSomewhere && e.secondaryTriggers.length > 0) {
      findings.push({
        rule: "key-points-nowhere",
        severity: "worth-a-look",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" has secondary keys, but none of its keys show up in any other entry's text.`,
      });
    }

    // 7. wakes-itself: entry content matches one of its own triggers
    for (const t of e.triggers) {
      if (keywordMatches(t, e.content, opts).hit) {
        findings.push({
          rule: "wakes-itself",
          severity: "problem",
          entryId: e.id,
          message: `Entry "${e.title || e.id}" can wake itself: its content contains its own key "${t.keyword}".`,
          fix: (b) => stripSelfWakeKey(b, e.id),
        });
        break;
      }
    }
  }

  // 8. never-woken: enabled keyword entry whose keys never appear in any other enabled entry's content
  //    AND is not constant. Use scanBook with each other entry's content as the only line.
  for (const e of entries) {
    if (!e.enabled || e.constant || e.vectorized) continue;
    if (e.triggers.length === 0) continue;
    if (e.excludeRecursion) continue; // intentional direct-only

    let woken = false;
    for (const other of entries) {
      if (other.id === e.id || !other.enabled) continue;
      const lines: ScanLine[] = [{ text: other.content, role: "system" }];
      // Single-entry book slice so only e is considered for key match against other's content
      const mini: LorebookBody = {
        ...book,
        entries: [{ ...e, delay: 0, cooldown: 0, sticky: 0, delayUntilRecursion: 0 }],
        globalRecursion: false,
      };
      const r = scanBook(mini, lines, { chanceMode: "always" });
      if (r.fired.some((f) => f.entryId === e.id)) {
        woken = true;
        break;
      }
    }
    if (!woken) {
      // Only flag if nothing in the book can wake it - common for chat-key entries, so
      // severity is worth-a-look (orphan in the recursion web).
      findings.push({
        rule: "never-woken",
        severity: "worth-a-look",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" is never woken by any other entry's text. It only fires from chat keys (or not at all).`,
      });
    }
  }

  // 9. never-fires
  for (const e of entries) {
    if (!e.enabled) continue;
    if (e.probability <= 0) {
      findings.push({
        rule: "never-fires",
        severity: "problem",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" has a 0% chance, so it never fires.`,
        fix: (b) => resetChanceContradiction(b, e.id),
      });
      continue;
    }
    if (e.delay > 1000) {
      findings.push({
        rule: "never-fires",
        severity: "worth-a-look",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" waits for ${e.delay} messages before it can fire.`,
      });
      continue;
    }
    if (
      !e.constant &&
      !e.vectorized &&
      e.triggers.length === 0 &&
      e.secondaryTriggers.length === 0
    ) {
      findings.push({
        rule: "never-fires",
        severity: "problem",
        entryId: e.id,
        message: `Entry "${e.title || e.id}" is on, has no keys, and is not always-on or by-meaning.`,
      });
    }
  }

  return findings;
}

/** Apply every fixable finding once (group Fix All). Idempotent when re-run on the result. */
export function applyAllFixes(book: LorebookBody, findings: readonly LoreFinding[]): LorebookBody {
  const seen = new Set<string>();
  let next = book;
  for (const f of findings) {
    if (!f.fix) continue;
    const key = `${f.rule}:${f.entryId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next = f.fix(next);
  }
  return next;
}
