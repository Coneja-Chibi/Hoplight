/**
 * What a piece says about itself: the peek fetch behind the close-up views and the shelf's
 * metadata facts (rough tokens, content tags, filled card fields, the source-format chip label).
 * Split from index.tsx by the one-concept-per-file cap; pure except the one tolerant getEntity.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PiecePeek } from "./view-contract";

const isBag = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Sum every written string on the body (depth-bounded), /4: the shared rough-token convention. */
function roughTokens(v: unknown, depth = 0): number {
  if (depth > 6) return 0;
  if (typeof v === "string") return v.length;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + roughTokens(x, depth + 1), 0);
  if (isBag(v)) return Object.values(v).reduce<number>((n, x) => n + roughTokens(x, depth + 1), 0);
  return 0;
}

/** The nine card fields a character card lives or dies by; "n/9" for the shelf meta line. */
function filledCardFields(body: Record<string, unknown>): string {
  const identity = isBag(body.identity) ? body.identity : {};
  const persona = isBag(body.persona) ? body.persona : {};
  const prompts = isBag(body.prompts) ? body.prompts : {};
  const greetings = isBag(body.greetings) ? body.greetings : {};
  const examples = isBag(body.examples) ? body.examples : {};
  const has = (v: unknown): boolean =>
    typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;
  const nine = [
    identity.name,
    persona.description,
    persona.personality,
    persona.scenario,
    greetings.firstMessage,
    greetings.alternateGreetings,
    examples.exampleMessages,
    prompts.systemPrompt,
    prompts.postHistoryInstructions,
  ];
  return `${nine.filter(has).length}/9`;
}

/** Fetch a piece's own words + shelf metadata for close-up views; tolerant (null on failure). */
export async function peekPiece(ctx: AppContext, e: StudioEntitySummary): Promise<PiecePeek | null> {
  try {
    const entity = (await ctx.api.getEntity(
      `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
    )) as { body?: unknown };
    const body = isBag(entity.body) ? entity.body : {};
    const identity = isBag(body.identity) ? body.identity : {};
    const persona = isBag(body.persona) ? body.persona : {};
    const discovery = isBag(body.discovery) ? body.discovery : {};
    const rawTags = e.kind === "character" ? discovery.tags : body.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string" && t.length > 0)
      : [];
    return {
      tagline: typeof identity.tagline === "string" ? identity.tagline : undefined,
      description: typeof persona.description === "string" ? persona.description : undefined,
      tokens: Math.round(roughTokens(body) / 4),
      tags: tags.length > 0 ? tags : undefined,
      filled: e.kind === "character" ? filledCardFields(body) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * "RoleCall · V3" / "CC V2" from the summary's source fields; null = made from scratch. The
 * generic Tavern reader's "Default" label meant nothing on a card chip - a plain character card
 * is a CC (character card) of some spec version, so say that.
 */
export function sourceLabelFor(
  formatLabels: Map<string, string>,
  e: StudioEntitySummary,
): string | null {
  if (!e.sourceFormat) return null;
  const base = formatLabels.get(e.sourceFormat) ?? e.sourceFormat;
  const variant = e.sourceVariant?.toUpperCase();
  if (base === "Default") return variant ? `CC ${variant}` : "CC";
  return variant ? `${base} · ${variant}` : base;
}
