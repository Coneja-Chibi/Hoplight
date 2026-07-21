/**
 * Thin authoring-aid key match preview. Not host-accurate activation.
 */
import type { LorebookEntry, SelectiveLogic } from "../../entities/lorebook/schema";

export interface SampleMatchHit {
  entryId: string;
  title: string;
  matched: "primary" | "secondary" | "constant" | "none";
}

function keywordHits(text: string, keyword: string, isRegex: boolean, flags?: string): boolean {
  if (!keyword) return false;
  if (isRegex) {
    try {
      return new RegExp(keyword, flags ?? "i").test(text);
    } catch {
      return false;
    }
  }
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function anyTrigger(text: string, triggers: LorebookEntry["triggers"]): boolean {
  return triggers.some((t) => keywordHits(text, t.keyword, t.isRegex, t.flags));
}

function selectiveOk(primary: boolean, secondary: boolean, logic: SelectiveLogic): boolean {
  switch (logic) {
    case "and_any":
      // the caller already passes empty-secondary entries straight through, so when this runs a
      // secondary list EXISTS and one of it must hit (the `|| true` here made and_any primary-only)
      return primary && secondary;
    case "and_all":
      return primary && secondary;
    case "not_any":
      return primary && !secondary;
    case "not_all":
      return primary && !secondary;
    default:
      return primary;
  }
}

/**
 * For each entry, report whether sample text would match at a simple documented level.
 * Constant entries always match. Selective logic is simplified (and_any treats empty secondary as ok).
 */
export function sampleMatchEntries(
  sampleText: string,
  entries: readonly LorebookEntry[],
): SampleMatchHit[] {
  const text = sampleText ?? "";
  return entries.map((e) => {
    if (e.constant) {
      return { entryId: e.id, title: e.title, matched: "constant" as const };
    }
    if (!e.enabled) {
      return { entryId: e.id, title: e.title, matched: "none" as const };
    }
    const primary = anyTrigger(text, e.triggers);
    const secondary = anyTrigger(text, e.secondaryTriggers);
    if (!primary && e.secondaryTriggers.length === 0) {
      return { entryId: e.id, title: e.title, matched: "none" as const };
    }
    const logic = e.secondaryTriggers.length === 0 ? "and_any" : e.selectiveLogic;
    const ok =
      e.secondaryTriggers.length === 0
        ? primary
        : selectiveOk(primary, secondary, logic);
    if (!ok) return { entryId: e.id, title: e.title, matched: "none" as const };
    if (primary) return { entryId: e.id, title: e.title, matched: "primary" as const };
    return { entryId: e.id, title: e.title, matched: "secondary" as const };
  });
}
