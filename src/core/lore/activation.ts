/**
 * Pure lorebook activation engine. One matcher for Rehearsal, Playback, Health cross-entry
 * rules, and the Web wake graph. Semantics follow SillyTavern world-info.js adapted to
 * canonical fields. Match helpers: match-keys.ts. Types: activation-types.ts.
 *
 * Provenance: ST world-info.js matchKeys ~L337, selective ~L4914, probability ~L5021, budget ~L5054.
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import type {
  ActivationOptions,
  ActivationResult,
  EntryVerdict,
  FireReason,
  ScanLine,
  TimedState,
  WakeEdge,
} from "./activation-types";
import {
  firstTriggerHit,
  keywordMatches,
  resolveMatchOpts,
  secondaryLogicOk,
  type MatchOpts,
} from "./match-keys";
import { estimateEntryTokens } from "./summary";

export type {
  ScanLine,
  ActivationOptions,
  TimedState,
  FireReason,
  SkipReason,
  EntryVerdict,
  ActivationResult,
  WakeEdge,
} from "./activation-types";
export type { MatchOpts, KeywordHit } from "./match-keys";
export { keywordMatches, resolveMatchOpts, secondaryLogicOk, firstTriggerHit } from "./match-keys";

const emptyTimed = (turn = 0): TimedState => ({
  stickyLeft: {},
  cooldownLeft: {},
  turn,
});

function scanWindow(
  lines: readonly ScanLine[],
  depth: number,
): { texts: string[]; absIndex: number[] } {
  if (depth <= 0 || lines.length === 0) return { texts: [], absIndex: [] };
  const start = Math.max(0, lines.length - depth);
  const texts: string[] = [];
  const absIndex: number[] = [];
  for (let i = start; i < lines.length; i++) {
    texts.push(lines[i]?.text ?? "");
    absIndex.push(i);
  }
  return { texts, absIndex };
}

/** Placement: the order kept entries EMIT. sortOrder is the placement axis; priority only ties. */
function placementOrder(entries: readonly LorebookEntry[]): LorebookEntry[] {
  return [...entries].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return 0;
  });
}

/**
 * Eviction: the order entries CLAIM budget. priority is the eviction axis per the schema contract
 * (higher survives, a separate axis from placement); sortOrder only breaks ties. Walking placement
 * order here instead is the bug where where-an-entry-sits decides whether it survives.
 */
function evictionOrder(entries: readonly LorebookEntry[]): LorebookEntry[] {
  return [...entries].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return 0;
  });
}

function chancePasses(
  entry: LorebookEntry,
  mode: ActivationOptions["chanceMode"],
  rng: () => number,
  isSticky: boolean,
): { ok: true } | { ok: false; rolled: number; needed: number } {
  if (mode === "always" || isSticky) return { ok: true };
  if (mode === "never") {
    if (entry.probability >= 100) return { ok: true };
    return { ok: false, rolled: 100, needed: entry.probability };
  }
  if (entry.probability >= 100) return { ok: true };
  if (entry.probability <= 0) return { ok: false, rolled: 0, needed: 0 };
  const rolled = rng() * 100;
  if (rolled <= entry.probability) return { ok: true };
  return { ok: false, rolled, needed: entry.probability };
}

function markTimed(
  entry: LorebookEntry,
  stickyLeft: Record<string, number>,
  cooldownLeft: Record<string, number>,
  freshSticky: Set<string>,
  freshCooldown: Set<string>,
): void {
  if (entry.sticky > 0) {
    stickyLeft[entry.id] = entry.sticky;
    freshSticky.add(entry.id);
  }
  if (entry.cooldown > 0) {
    cooldownLeft[entry.id] = entry.cooldown;
    freshCooldown.add(entry.id);
  }
}

function setSkip(
  map: Map<string, EntryVerdict>,
  entry: LorebookEntry,
  reason: EntryVerdict["reason"],
  loop: number,
): void {
  map.set(entry.id, {
    entryId: entry.id,
    fired: false,
    reason,
    loop,
    tokenCost: estimateEntryTokens(entry),
  });
}

function setFire(
  map: Map<string, EntryVerdict>,
  firedIds: Set<string>,
  entry: LorebookEntry,
  reason: FireReason,
  loop: number,
  recurseTexts: string[],
): void {
  map.set(entry.id, {
    entryId: entry.id,
    fired: true,
    reason,
    loop,
    tokenCost: estimateEntryTokens(entry),
  });
  firedIds.add(entry.id);
  if (!entry.preventRecursion && entry.content) recurseTexts.push(entry.content);
}

/**
 * Activate a book against a chat window. Pure: no clock, no Math.random, no I/O.
 * Every entry gets exactly one final verdict. Recursion + budget honored.
 */
export function scanBook(
  book: LorebookBody,
  lines: readonly ScanLine[],
  opts: ActivationOptions = { chanceMode: "always" },
): ActivationResult {
  const maxLoops = Math.min(Math.max(opts.maxRecursionLoops ?? 3, 0), 10);
  const rng = opts.rng ?? (() => 0.5);
  const prev = opts.turnState ?? emptyTimed(0);
  const stickyLeft: Record<string, number> = { ...prev.stickyLeft };
  const cooldownLeft: Record<string, number> = { ...prev.cooldownLeft };
  const freshSticky = new Set<string>();
  const freshCooldown = new Set<string>();

  const entries = Array.isArray(book.entries) ? book.entries : [];
  const chatLen = lines.length;
  const verdictById = new Map<string, EntryVerdict>();
  const firedIds = new Set<string>();
  const recurseTexts: string[] = [];

  for (const e of entries) {
    if (!e.enabled) setSkip(verdictById, e, { kind: "disabled" }, 0);
  }

  let loopsRun = 0;

  for (let loop = 0; loop <= maxLoops; loop++) {
    let newThisLoop = 0;
    loopsRun = loop;

    for (const entry of entries) {
      if (!entry.enabled || firedIds.has(entry.id)) continue;

      const matchOpts = resolveMatchOpts(entry, book);
      const cd = cooldownLeft[entry.id] ?? 0;
      if (cd > 0) {
        setSkip(verdictById, entry, { kind: "cooldown", remaining: cd }, loop);
        continue;
      }

      if (entry.delay > 0 && chatLen < entry.delay) {
        setSkip(verdictById, entry, { kind: "delay", needs: entry.delay, have: chatLen }, loop);
        continue;
      }

      const stickyRem = stickyLeft[entry.id] ?? 0;
      if (stickyRem > 0) {
        setFire(verdictById, firedIds, entry, { kind: "sticky", remaining: stickyRem }, loop, recurseTexts);
        newThisLoop += 1;
        continue;
      }

      if (entry.vectorized) {
        setSkip(verdictById, entry, { kind: "vectorized" }, loop);
        continue;
      }

      if (entry.constant) {
        const ch = chancePasses(entry, opts.chanceMode, rng, false);
        if (!ch.ok) {
          setSkip(verdictById, entry, { kind: "chance", rolled: ch.rolled, needed: ch.needed }, loop);
          continue;
        }
        setFire(verdictById, firedIds, entry, { kind: "constant" }, loop, recurseTexts);
        markTimed(entry, stickyLeft, cooldownLeft, freshSticky, freshCooldown);
        newThisLoop += 1;
        continue;
      }

      if (entry.delayUntilRecursion > 0 && loop < entry.delayUntilRecursion) {
        setSkip(verdictById, entry, {
          kind: "delay-until-recursion",
          needs: entry.delayUntilRecursion,
          have: loop,
        }, loop);
        continue;
      }

      if (loop > 0 && entry.excludeRecursion) {
        setSkip(verdictById, entry, { kind: "exclude-recursion" }, loop);
        continue;
      }

      if (entry.triggers.length === 0) {
        setSkip(verdictById, entry, { kind: "empty-keys" }, loop);
        continue;
      }

      const depth = entry.scanDepth ?? book.globalScanDepth;
      const window = scanWindow(lines, depth);
      const scanTexts = loop === 0 ? window.texts : [...window.texts, ...recurseTexts];
      const primary = firstTriggerHit(entry.triggers, scanTexts, matchOpts);
      if (!primary) {
        setSkip(verdictById, entry, { kind: "no-key-match" }, loop);
        continue;
      }

      if (entry.secondaryTriggers.length > 0) {
        let any = false;
        let all = true;
        for (const t of entry.secondaryTriggers) {
          let hit = false;
          for (const text of scanTexts) {
            if (keywordMatches(t, text, matchOpts).hit) {
              hit = true;
              break;
            }
          }
          if (hit) any = true;
          else all = false;
        }
        if (!secondaryLogicOk(entry.selectiveLogic, any, all)) {
          setSkip(verdictById, entry, { kind: "secondary-logic", logic: entry.selectiveLogic }, loop);
          continue;
        }
      }

      const ch = chancePasses(entry, opts.chanceMode, rng, false);
      if (!ch.ok) {
        setSkip(verdictById, entry, { kind: "chance", rolled: ch.rolled, needed: ch.needed }, loop);
        continue;
      }

      const inChat = primary.lineIndex < window.texts.length;
      let reason: FireReason;
      if (!inChat && loop > 0) {
        let from = "";
        for (const other of entries) {
          if (!firedIds.has(other.id) || other.preventRecursion) continue;
          if (
            keywordMatches({ keyword: primary.keyword, isRegex: false }, other.content, matchOpts).hit ||
            entry.triggers.some((t) => keywordMatches(t, other.content, matchOpts).hit)
          ) {
            from = other.id;
            break;
          }
        }
        reason = { kind: "recursion", wokeBy: from, keyword: primary.keyword, loop };
      } else {
        const absLine = inChat
          ? (window.absIndex[primary.lineIndex] ?? primary.lineIndex)
          : primary.lineIndex;
        reason = {
          kind: "key",
          keyword: primary.keyword,
          lineIndex: absLine,
          wholeWord: matchOpts.wholeWords,
          caseSensitive: matchOpts.caseSensitive,
        };
      }

      setFire(verdictById, firedIds, entry, reason, loop, recurseTexts);
      markTimed(entry, stickyLeft, cooldownLeft, freshSticky, freshCooldown);
      newThisLoop += 1;
    }

    if (newThisLoop === 0) break;
    if (loop >= maxLoops) break;
    if (!book.globalRecursion && loop === 0) break;
  }

  for (const id of Object.keys(stickyLeft)) {
    if (freshSticky.has(id)) continue;
    stickyLeft[id] = (stickyLeft[id] ?? 0) - 1;
    if ((stickyLeft[id] ?? 0) <= 0) delete stickyLeft[id];
  }
  for (const id of Object.keys(cooldownLeft)) {
    if (freshCooldown.has(id)) continue;
    cooldownLeft[id] = (cooldownLeft[id] ?? 0) - 1;
    if ((cooldownLeft[id] ?? 0) <= 0) delete cooldownLeft[id];
  }

  const ordered = placementOrder(entries.filter((e) => firedIds.has(e.id)));
  const limit = opts.tokenBudget ?? null;
  let spent = 0;
  const cuts: EntryVerdict[] = [];
  const keptIds = new Set<string>();

  if (limit === null) {
    for (const e of ordered) keptIds.add(e.id);
    spent = ordered.reduce((s, e) => s + estimateEntryTokens(e), 0);
  } else {
    for (const e of evictionOrder(ordered)) {
      const cost = estimateEntryTokens(e);
      if (e.ignoreBudget) {
        keptIds.add(e.id);
        spent += cost;
        continue;
      }
      if (spent + cost > limit) {
        const cut: EntryVerdict = {
          entryId: e.id,
          fired: false,
          reason: { kind: "budget-cut", wouldCost: cost, left: Math.max(0, limit - spent) },
          loop: verdictById.get(e.id)?.loop ?? 0,
          tokenCost: cost,
        };
        cuts.push(cut);
        verdictById.set(e.id, cut);
        firedIds.delete(e.id);
      } else {
        keptIds.add(e.id);
        spent += cost;
      }
    }
  }

  for (const e of entries) {
    if (!verdictById.has(e.id)) setSkip(verdictById, e, { kind: "no-key-match" }, 0);
  }

  const verdicts = entries.map(
    (e) =>
      verdictById.get(e.id) ?? {
        entryId: e.id,
        fired: false,
        reason: { kind: "no-key-match" as const },
        loop: 0,
        tokenCost: 0,
      },
  );
  const fired = ordered
    .filter((e) => keptIds.has(e.id))
    .map((e) => verdictById.get(e.id)!)
    .filter(Boolean);

  return {
    verdicts,
    fired,
    budget: { limit, spent, cuts },
    loops: loopsRun,
    nextTurnState: { stickyLeft, cooldownLeft, turn: prev.turn + 1 },
  };
}

/**
 * Recursion wake edges for the Web lens. preventRecursion = no outbound;
 * excludeRecursion = no inbound. Uses the same keywordMatches as scanBook.
 */
export function bookWakeGraph(book: LorebookBody): { edges: WakeEdge[] } {
  const entries = Array.isArray(book.entries) ? book.entries : [];
  const edges: WakeEdge[] = [];
  for (const a of entries) {
    if (!a.enabled || a.preventRecursion || a.vectorized) continue;
    if (a.triggers.length === 0 && !a.constant) continue;
    for (const b of entries) {
      if (a.id === b.id) continue;
      if (!b.enabled || b.excludeRecursion || b.vectorized || b.constant) continue;
      if (b.triggers.length === 0) continue;
      const opts: MatchOpts = resolveMatchOpts(b, book);
      for (const t of b.triggers) {
        const r = keywordMatches(t, a.content, opts);
        if (r.hit) {
          edges.push({ from: a.id, to: b.id, keyword: r.keyword });
          break;
        }
      }
    }
  }
  return { edges };
}
