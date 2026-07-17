/**
 * The prompt list's view state: counts, the filter tabs, and search. Ported from RC's PromptListV4
 * (its `counts` memo, `filterForMainSections`, and `promptMatchesSearch`), kept as pure functions so
 * the list component stays a renderer and this stays testable.
 *
 * RC keys its tabs off injection_position (0 = relative, 1 = in-chat). vaud's canonical model uses
 * PLACEMENT, so the tabs map onto placement here: relative -> "relative", in-chat -> the at-depth
 * stops. Do not compare to raw numbers - per-platform truth lives in platform-fields.ts.
 */
import type { PresetGroup, PresetPrompt } from "../../entities/preset";

export type PromptFilterTab = "all" | "relative" | "inchat";

export const PROMPT_FILTER_TABS: readonly PromptFilterTab[] = ["all", "relative", "inchat"];

export const PROMPT_FILTER_LABELS: Record<PromptFilterTab, string> = {
  all: "All Prompts",
  relative: "Relative",
  inchat: "In-Chat",
};

/** The stops that read as "injected into chat at a depth" rather than sitting in preset order. */
const IN_CHAT_PLACEMENTS = new Set(["in_chat", "append"]);

const isInChat = (p: PresetPrompt): boolean => IN_CHAT_PLACEMENTS.has(p.placement);
const isRelative = (p: PresetPrompt): boolean => p.placement === "relative";

export interface PromptCounts {
  total: number;
  relative: number;
  inchat: number;
  enabled: number;
}

/** Tab badge counts. Counted over ALL blocks, never the filtered view (RC does the same). */
export function promptCounts(prompts: readonly PresetPrompt[]): PromptCounts {
  let relative = 0, inchat = 0, enabled = 0;
  for (const p of prompts) {
    if (isRelative(p)) relative++;
    if (isInChat(p)) inchat++;
    if (p.enabled) enabled++;
  }
  return { total: prompts.length, relative, inchat, enabled };
}

/** RC matches a prompt on its name OR its content, case-insensitively. */
export function promptMatchesSearch(prompt: PresetPrompt, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return prompt.name.toLowerCase().includes(q) || prompt.content.toLowerCase().includes(q);
}

/** The blocks a tab shows, before search. */
export function filterByTab(prompts: readonly PresetPrompt[], tab: PromptFilterTab): PresetPrompt[] {
  if (tab === "relative") return prompts.filter(isRelative);
  if (tab === "inchat") return prompts.filter(isInChat);
  return [...prompts];
}

/** The visible list: tab first, then search. */
export function visiblePrompts(
  prompts: readonly PresetPrompt[],
  tab: PromptFilterTab,
  query: string,
): PresetPrompt[] {
  return filterByTab(prompts, tab).filter((p) => promptMatchesSearch(p, query));
}

/* ---------- categories (RC's PromptListV4 sections) ---------- */

export interface PromptSection {
  /** null = the uncategorized run that sits above the folders */
  group: PresetGroup | null;
  prompts: PresetPrompt[];
}

/**
 * Split a (already filtered) list into the uncategorized run plus one section per group, groups in
 * their `order` then declaration order. A block whose groupId names no existing group is treated as
 * uncategorized rather than dropped - losing a block to a dangling reference would be silent data
 * loss on an imported preset.
 *
 * Empty sections are KEPT: a folder you just made, or one whose blocks the filter hid, still has to
 * be visible or you cannot drop anything into it.
 */
export function groupSections(
  prompts: readonly PresetPrompt[],
  groups: readonly PresetGroup[] = [],
): PromptSection[] {
  const known = new Map(groups.map((g) => [g.id, g]));
  const byGroup = new Map<string, PresetPrompt[]>();
  const loose: PresetPrompt[] = [];
  for (const p of prompts) {
    if (p.groupId === undefined || !known.has(p.groupId)) {
      loose.push(p);
      continue;
    }
    const bucket = byGroup.get(p.groupId);
    if (bucket) bucket.push(p);
    else byGroup.set(p.groupId, [p]);
  }
  const ordered = [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sections: PromptSection[] = [{ group: null, prompts: loose }];
  for (const g of ordered) sections.push({ group: g, prompts: byGroup.get(g.id) ?? [] });
  return sections;
}
