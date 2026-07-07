/**
 * Pure derivations for the character editor - tolerant readers and rough estimates over a draft body,
 * lifted out of Editor.tsx so they get a tested home the component body never gave them. No React, no
 * state: deterministic functions of a plain object.
 */
import { readPath } from "./editor-core";

/** tolerant reader for the app-wide editor scale (out-of-range or malformed drops to 1). */
export const parseScale = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : 1;

/** a plain object, or {} for anything else (null / array / primitive) */
export const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
/** a string, or "" for anything else */
export const str = (x: unknown): string => (typeof x === "string" ? x : "");
/** the string members of an array, or [] */
export const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

export interface Greeting {
  text: string;
  title?: string;
}

/** the greetings at a path as {text,title} rows (tolerant; non-arrays -> []) */
export const greetingsOf = (draft: unknown, path: string): Greeting[] => {
  const raw = readPath(draft, path);
  if (!Array.isArray(raw)) return [];
  return raw.map((g) => ({ text: str(rec(g).text), title: str(rec(g).title) || undefined }));
};

/** honest rough size: prose chars / 4, labeled "~tokens" (a real tokenizer is macro-layer work) */
export function tokenEstimate(draft: unknown): number {
  const paths = ["identity.description", "persona.personality", "persona.scenario", "greetings.firstMessage", "examples.exampleMessages", "prompts.systemPrompt"];
  const chars = paths.reduce((n, p) => n + str(readPath(draft, p)).length, 0);
  return Math.round(chars / 4);
}
