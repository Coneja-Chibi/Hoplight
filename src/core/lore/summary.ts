/**
 * Deterministic lorebook chips for Library/Press (pure, no mutation).
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";

export interface LoreSummary {
  name: string;
  entryCount: number;
  enabledCount: number;
  disabledCount: number;
  keyCount: number;
  constantCount: number;
}

const entryKeys = (e: LorebookEntry): number =>
  e.triggers.length + e.secondaryTriggers.length;

/**
 * Rough token estimate (~4 chars/token, the industry rule of thumb). An AUTHORING gauge for the
 * desk's chips and budget meter, never a billing or host-accurate count - the desk labels it "~".
 */
export function estimateEntryTokens(e: LorebookEntry): number {
  return Math.ceil((e.title.length + e.content.length) / 4);
}

export function estimateBookTokens(body: LorebookBody): number {
  const entries = Array.isArray(body.entries) ? body.entries : [];
  return entries.reduce((sum, e) => sum + estimateEntryTokens(e), 0);
}

export function loreSummary(body: LorebookBody): LoreSummary {
  const entries = Array.isArray(body.entries) ? body.entries : [];
  let enabledCount = 0;
  let keyCount = 0;
  let constantCount = 0;
  for (const e of entries) {
    if (e.enabled) enabledCount += 1;
    if (e.constant) constantCount += 1;
    keyCount += entryKeys(e);
  }
  return {
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "(unnamed)",
    entryCount: entries.length,
    enabledCount,
    disabledCount: entries.length - enabledCount,
    keyCount,
    constantCount,
  };
}
