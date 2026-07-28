/**
 * Turning a macro that splices content into the structural block a target uses instead.
 *
 * WHY THIS CANNOT BE A TEXT REWRITE. `{{message_history}}` asks an engine to drop the transcript in
 * at that spot. SillyTavern does the same job with a MARKER PROMPT - a prompt-list entry whose
 * identifier the builder recognises and fills during assembly. There is no macro to rewrite it to,
 * so a translator that only edits strings can do nothing but delete it, which is what happened: the
 * receipt honestly reported a removal and the preset quietly lost its transcript.
 *
 * A block is therefore SPLIT rather than edited. Text before the macro stays a prompt block, the
 * macro becomes a marker block, and text after it becomes another prompt block - in that order, so
 * what surrounded the splice still surrounds it.
 *
 *     "Recent events:\n{{message_history}}\nRespond in character."
 *       ->  prompt   "Recent events:"
 *           marker   chatHistory
 *           prompt   "Respond in character."
 *
 * PROMOTION HAPPENS ONLY WHEN THE SLOT IS UNAMBIGUOUS. A dead macro is matched against the canonical
 * marker slots by shared word, and exactly one match promotes; zero or several leave the token alone
 * for a person to place. Guessing a slot moves authored content to the wrong part of the prompt,
 * which is far harder to notice than a macro that stayed put.
 */
import { MARKER_LABELS } from "../build";
import { macroName, scanMacroTokens } from "./support";

/** One block that became several, recorded so the restructuring is never silent. */
export interface Promotion {
  /** The block that was split. */
  block: string;
  token: string;
  markerSlot: string;
  /** How many blocks replaced it, including the marker. */
  became: number;
}

export interface MarkerPromotion {
  /** A copy of the body with blocks split. The input is never mutated. */
  body: unknown;
  promotions: Promotion[];
}

/** Words worth matching on; shorter ones would pair almost anything with anything. */
const wordsOf = (name: string): string[] =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 4);

/**
 * The single marker slot this macro name unambiguously means, or null.
 *
 * Null covers both "nothing matched" and "several matched", because both are cases where a person
 * has to decide. The slot list comes from the canonical model rather than being restated, so a slot
 * added there is promotable without an edit here.
 */
export function markerSlotFor(macro: string): string | null {
  const name = macroName(macro);
  if (!name) return null;
  const words = new Set(wordsOf(name));
  const hits = Object.keys(MARKER_LABELS).filter((slot) => wordsOf(slot).some((w) => words.has(w)));
  return hits.length === 1 ? hits[0]! : null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Split every prompt block whose text splices a marker-shaped macro.
 *
 * `deadTokens` are the macros a transfer check already found have no home on the target, passed in
 * rather than recomputed: a macro the target CAN run must never be promoted, or a working preset
 * gets restructured for no reason.
 */
export function promoteMarkers(body: unknown, deadTokens: readonly string[]): MarkerPromotion {
  const copy = structuredClone(body) as { prompts?: unknown } | null;
  const prompts = copy?.prompts;
  if (!Array.isArray(prompts)) return { body: copy, promotions: [] };

  const dead = new Set(deadTokens);
  const promotions: Promotion[] = [];
  const rebuilt: unknown[] = [];

  for (const prompt of prompts) {
    if (!isRecord(prompt) || typeof prompt["content"] !== "string") {
      rebuilt.push(prompt);
      continue;
    }
    const content = prompt["content"];
    const token = scanMacroTokens(content).find((t) => dead.has(t) && markerSlotFor(t) !== null);
    if (!token) {
      rebuilt.push(prompt);
      continue;
    }

    const slot = markerSlotFor(token)!;
    const at = content.indexOf(token);
    const before = content.slice(0, at).trim();
    const after = content.slice(at + token.length).trim();
    const id = typeof prompt["id"] === "string" ? prompt["id"] : "block";
    const name = typeof prompt["name"] === "string" ? prompt["name"] : id;

    const pieces: unknown[] = [];
    if (before) pieces.push({ ...prompt, id: `${id}-before`, name: `${name} (before)`, content: before });
    pieces.push({
      ...prompt,
      id: slot,
      name,
      content: "",
      marker: true,
      markerSlot: slot,
    });
    if (after) pieces.push({ ...prompt, id: `${id}-after`, name: `${name} (after)`, content: after });

    rebuilt.push(...pieces);
    promotions.push({ block: name, token, markerSlot: slot, became: pieces.length });
  }

  if (promotions.length > 0) (copy as { prompts: unknown[] }).prompts = rebuilt;
  return { body: copy, promotions };
}
