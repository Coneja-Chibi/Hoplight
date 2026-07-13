/**
 * The preset ASSEMBLY / preview engine (PRESET-JEWEL-PLAN.md P2): canonical-only, pure. Turns a
 * PresetBody into the built-preview structure the LiveBuild pane renders (engine-truth, never a
 * mock) and the weight stats the manuscript shows. FORWARD direction only (canonical -> built); the
 * wire<->canonical codecs (parse/serialize, the Round-Trip Law) are P5, where a real fixture makes
 * the round-trip provable.
 *
 * Scope is honest-small on purpose: order the enabled blocks, LABEL markers where content splices at
 * runtime (real splicing needs a chat surface vaud does not have yet - same tier as the walkthrough
 * runtime), and count tokens by the chars/4 convention (never stored). Macros stay literal - that IS
 * what the block holds; a runtime resolves them against a real chat. Groups are authoring structure,
 * not build order; choices gate blocks only once answered at runtime - both are ignored here.
 */
import type { PresetBody, PresetPrompt, PromptRole } from "../../entities/preset";

/** chars/4, the lore/persona token convention. A marker has no content of its own -> 0 ("slot"). */
export const blockTokens = (block: PresetPrompt): number =>
  block.marker ? 0 : Math.ceil(block.content.length / 4);

export interface PresetWeight {
  totalCount: number;
  enabledCount: number;
  /** enabled blocks that inject into the chat at depth (in_chat/append), not the preset sequence */
  inChatCount: number;
  /** sum of chars/4 over enabled non-marker blocks */
  tokens: number;
  largest: { id: string; name: string; tokens: number } | null;
}

/** The manuscript's live weight: enabled count, in-chat count, total tokens, heaviest block. */
export function presetWeight(body: PresetBody): PresetWeight {
  let enabledCount = 0;
  let inChatCount = 0;
  let tokens = 0;
  let largest: { id: string; name: string; tokens: number } | null = null;
  for (const b of body.prompts) {
    if (!b.enabled) continue;
    enabledCount++;
    if (b.placement === "in_chat" || b.placement === "append") inChatCount++;
    const t = blockTokens(b);
    tokens += t;
    if (!largest || t > largest.tokens) largest = { id: b.id, name: b.name, tokens: t };
  }
  return { totalCount: body.prompts.length, enabledCount, inChatCount, tokens, largest };
}

/** Plain-language labels for the ST-compatible marker slots (where content splices at runtime). */
export const MARKER_LABELS: Record<string, string> = {
  chatHistory: "the chat history",
  worldInfoBefore: "world info (before)",
  worldInfoAfter: "world info (after)",
  dialogueExamples: "the example messages",
  personaDescription: "the persona description",
  charDescription: "the character description",
  charPersonality: "the character personality",
  scenario: "the scenario",
};

/** What a marker line reads as in the built preview (plain, self-describing, no macro fakery). */
export const markerLabel = (slot: string | undefined): string =>
  `${MARKER_LABELS[slot ?? ""] ?? slot ?? "a placeholder"} splices in here`;

/** Build-order rank; within a rank, injectionOrder ascending (lower first - the ST rule). */
const PLACEMENT_RANK: Record<string, number> = {
  prepend_preset: 0,
  relative: 1,
  in_chat: 2,
  append: 2,
  append_preset: 3,
};
const rankOf = (placement: string): number => PLACEMENT_RANK[placement] ?? 1;

export interface PresetBuildLine {
  id: string;
  name: string;
  role: PromptRole;
  placement: string;
  /** the block content, OR the marker "splices in here" label when marker */
  text: string;
  isMarker: boolean;
  markerSlot?: string;
  /** the depth for in_chat/append placements, else undefined */
  depth?: number;
  tokens: number;
}

export interface PresetBuild {
  lines: PresetBuildLine[];
  weight: PresetWeight;
}

/**
 * The built preview: enabled blocks in BUILD order (placement rank, then injectionOrder), each
 * rendered as engine-truth. Deterministic (stable sort preserves authoring order within a tie).
 */
export function buildPreview(body: PresetBody): PresetBuild {
  const ordered = body.prompts
    .filter((b) => b.enabled)
    .sort((a, b) => rankOf(a.placement) - rankOf(b.placement) || a.injectionOrder - b.injectionOrder);
  const lines: PresetBuildLine[] = ordered.map((b) => {
    const atDepth = b.placement === "in_chat" || b.placement === "append";
    return {
      id: b.id,
      name: b.name,
      role: b.role,
      placement: b.placement,
      isMarker: b.marker,
      markerSlot: b.markerSlot,
      depth: atDepth ? b.injectionDepth : undefined,
      tokens: blockTokens(b),
      text: b.marker ? markerLabel(b.markerSlot) : b.content,
    };
  });
  return { lines, weight: presetWeight(body) };
}
