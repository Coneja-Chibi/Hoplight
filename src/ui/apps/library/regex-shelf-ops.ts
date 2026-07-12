/**
 * Regex shelf side-effects: per-set meta load (enabled, rule counts, computed "does what") plus the
 * set-level ops a shelf card fires (toggle on/off, duplicate, split, merge). Patterned on
 * lore-shelf-ops.ts; the loaders are pure-ish and the saves sit at the imperative edge.
 *
 * The pure set transforms (duplicateSet / mergeSets / splitSet) live here, unit-tested in
 * regex-shelf-ops.test.ts, because the shelf is their only consumer today. Promote them to
 * core/regex when the set editor needs the same transforms (a live parallel session owns
 * core/regex right now, so keeping these local also avoids colliding on core/regex/index.ts).
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { explainPattern } from "../../../core/regex";
import type { CanonicalRegexSet, RegexRule, RegexSetBody } from "../../../entities/regex/schema";
import { createAndOpenRegexSet } from "./new-regex-set";
import type { DeckViewContext } from "./view-contract";

export type RegexMeta = {
  enabled: boolean;
  ruleCount: number;
  enabledRuleCount: number;
  doesWhat: string;
};

/** Regex workshop dialog state (split one set, or merge two); mirrors LoreWorkshopState. */
export type RegexWorkshopState = {
  mode: "split" | "merge";
  source: StudioEntitySummary;
  other?: StudioEntitySummary;
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// -- pure set transforms ----------------------------------------------------------------------------

/** Sort by sortOrder, reindex from 0 step 10 (stable, matches lore's renumber). */
const renumber = (rules: readonly RegexRule[]): RegexRule[] =>
  [...rules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r, i) => ({ ...r, sortOrder: i * 10 }));

/**
 * Clone rules with fresh, prefix-unique ids, remapping each rule's within-set condition.ruleId to
 * the new ids so a duplicated/merged set's chaining points at the copy, never the original.
 */
const freshRuleIds = (rules: readonly RegexRule[], prefix: string): RegexRule[] => {
  const idMap = new Map<string, string>();
  rules.forEach((r, i) => idMap.set(r.id, `${prefix}${i + 1}`));
  return rules.map((r, i) => {
    const clone = structuredClone(r) as RegexRule;
    clone.id = `${prefix}${i + 1}`;
    if (clone.condition) {
      const mapped = idMap.get(clone.condition.ruleId);
      if (mapped) clone.condition = { ...clone.condition, ruleId: mapped };
    }
    return clone;
  });
};

/** Deep clone with a new name; rule ids refreshed (conditions remapped), sortOrder renumbered. */
export function duplicateSet(body: RegexSetBody, name: string): RegexSetBody {
  const n = name.trim() || `${body.name.trim() || "Regex set"} (copy)`;
  return {
    ...structuredClone(body),
    name: n,
    rules: renumber(freshRuleIds(body.rules ?? [], "dup_")),
  };
}

/**
 * Merge two sets into a new one. Fresh ids per side (prefixes keep them unique across the join),
 * conditions remapped within each side, sortOrder renumbered. The result is on by default.
 */
export function mergeSets(a: RegexSetBody, b: RegexSetBody, newName?: string): RegexSetBody {
  const name =
    (newName?.trim() ||
      [a.name, b.name]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" + ")) ||
    "Merged regex set";
  const combined = [...freshRuleIds(a.rules ?? [], "m_a_"), ...freshRuleIds(b.rules ?? [], "m_b_")];
  return {
    name,
    ...(a.description ?? b.description ? { description: a.description ?? b.description } : {}),
    rules: renumber(combined),
  };
}

/**
 * Split: moved ids become a new set; the remainder stays. Rule ids are preserved in each result
 * (so a moved rule whose condition names a rule left behind simply dangles, which the engine skips
 * per the schema doc); sortOrder renumbered. Empty movedIds throws.
 */
export function splitSet(
  body: RegexSetBody,
  movedIds: readonly string[],
  newName: string,
): { remainder: RegexSetBody; split: RegexSetBody } {
  if (movedIds.length === 0) {
    throw new Error("regex-shelf: split needs at least one rule to move");
  }
  const name = newName.trim() || "Split regex set";
  const want = new Set(movedIds);
  const rules = body.rules ?? [];
  const moved = rules.filter((r) => want.has(r.id));
  const kept = rules.filter((r) => !want.has(r.id));
  if (moved.length === 0) {
    throw new Error("regex-shelf: none of the moved ids exist in the set");
  }
  const remainder: RegexSetBody = { ...structuredClone(body), rules: renumber(kept) };
  const split: RegexSetBody = {
    name,
    ...(body.description ? { description: body.description } : {}),
    rules: renumber(structuredClone(moved) as RegexRule[]),
  };
  return { remainder, split };
}

/** A rule's own plain-language label, or a short honest read of its pattern when unlabeled. */
const ruleLabel = (r: RegexRule): string => {
  const label = r.label?.trim();
  if (label) return label;
  const ex = explainPattern(r.find, r.flags);
  if (ex.phrases.length > 0) return `match ${ex.phrases.slice(0, 3).join("/")}`;
  return "";
};

/**
 * The set's computed "does what" line (engine truth, no model call): the set's own description if
 * it has one, else a join of the first few rule labels ("Fix ellipsis, Curl quotes +4 more"),
 * else an honest empty state.
 */
export function doesWhatForSet(body: RegexSetBody): string {
  const desc = body.description?.trim();
  if (desc) return desc;
  const rules = body.rules ?? [];
  if (rules.length === 0) return "No rules yet.";
  const labels = rules.map(ruleLabel).filter((l) => l.length > 0);
  if (labels.length === 0) {
    return `${rules.length} ${rules.length === 1 ? "rule" : "rules"}, unnamed.`;
  }
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
}

// -- meta load + ops bag ----------------------------------------------------------------------------

export async function loadRegexMeta(
  ctx: AppContext,
  list: readonly StudioEntitySummary[],
): Promise<Record<string, RegexMeta>> {
  const sets = list.filter((e) => e.kind === "regex");
  const next: Record<string, RegexMeta> = {};
  for (const s of sets) {
    try {
      const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(s.id)}`);
      const body = isRec(raw) && isRec(raw.body) ? (raw.body as unknown as RegexSetBody) : null;
      if (!body) continue;
      const rules = Array.isArray(body.rules) ? body.rules : [];
      next[s.id] = {
        enabled: body.enabled !== false,
        ruleCount: rules.length,
        enabledRuleCount: rules.filter((r) => r.enabled !== false).length,
        doesWhat: doesWhatForSet(body),
      };
    } catch {
      /* skip unreadable */
    }
  }
  return next;
}

export function makeRegexShelf(args: {
  ctx: AppContext;
  regexMeta: Record<string, RegexMeta>;
  setRegexMeta: (fn: (m: Record<string, RegexMeta>) => Record<string, RegexMeta>) => void;
  setWorkshop: (s: RegexWorkshopState) => void;
  reload: () => void;
}): NonNullable<DeckViewContext["regexShelf"]> {
  const { ctx, regexMeta, setRegexMeta, setWorkshop, reload } = args;
  return {
    enabledOf: (e) => regexMeta[e.id]?.enabled !== false,
    ruleCountOf: (e) => regexMeta[e.id]?.ruleCount,
    enabledRuleCountOf: (e) => regexMeta[e.id]?.enabledRuleCount,
    doesWhatOf: (e) => regexMeta[e.id]?.doesWhat,
    slowCountOf: () => undefined, // R4 Health wires this; the chip stays a quiet placeholder until then
    onToggleEnabled: (e, on) => {
      void (async () => {
        try {
          const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(e.id)}`);
          if (!isRec(raw) || !isRec(raw.body)) return;
          const body = { ...(raw.body as unknown as RegexSetBody), enabled: on };
          await ctx.api.saveEntity(
            {
              schemaVersion: CANONICAL_SCHEMA_VERSION,
              kind: "regex",
              id: e.id,
              body,
              original: isRec(raw.original) ? (raw.original as CanonicalRegexSet["original"]) : {},
            } satisfies CanonicalRegexSet,
            { overwrite: true },
          );
          setRegexMeta((m) => ({
            ...m,
            [e.id]: {
              enabled: on,
              ruleCount: m[e.id]?.ruleCount ?? body.rules?.length ?? 0,
              enabledRuleCount: m[e.id]?.enabledRuleCount ?? 0,
              doesWhat: m[e.id]?.doesWhat ?? doesWhatForSet(body),
            },
          }));
          ctx.setStatus(on ? `${e.name} is on` : `${e.name} is off (skipped on export)`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "toggle failed");
        }
      })();
    },
    onSplit: (e) => setWorkshop({ mode: "split", source: e }),
    onMerge: (into, from) => setWorkshop({ mode: "merge", source: into, other: from }),
    onDuplicate: (e) => {
      void (async () => {
        try {
          const raw = await ctx.api.getEntity(`kind=regex&id=${encodeURIComponent(e.id)}`);
          if (!isRec(raw) || !isRec(raw.body)) return;
          const body = duplicateSet(raw.body as unknown as RegexSetBody, `${e.name} (copy)`);
          const saved = await ctx.api.saveEntity({
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            kind: "regex",
            id: "regex",
            body,
          } satisfies CanonicalRegexSet);
          reload();
          ctx.setStatus(`duplicated · ${saved.name || body.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "duplicate failed");
        }
      })();
    },
    onNew: () => {
      void (async () => {
        try {
          const summary = await createAndOpenRegexSet(ctx);
          reload();
          ctx.workbench.send(summary);
          ctx.setStatus(`opened regex set · ${summary.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "could not create set");
        }
      })();
    },
  };
}
