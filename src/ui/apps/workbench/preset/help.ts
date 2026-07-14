/**
 * Field help copy for the EDIT PROMPT sidebar - transcribed from RC's PROMPT_TOOLTIPS +
 * PROMPT_EDIT_ACTION_TOOLTIPS (packages/ui/.../editor-tooltips.ts). RC renders these as rich
 * Paradox-style hover cards; vaud shows a compact "?" dot with the same text in a native tooltip
 * (a shared rich-tooltip card is a cross-editor concern, deferred). Copy is UI-facing, so it lives
 * in the UI layer, not core.
 */
export interface FieldHelp {
  title: string;
  description: string;
  bullets?: string[];
}

export const PROMPT_HELP = {
  role: {
    title: "Message Role",
    description:
      "The role this prompt plays in the conversation. Affects how the AI interprets and responds to the content.",
    bullets: [
      "System: instructions and rules for the AI",
      "User: simulates user messages",
      "Assistant: pre-filled AI responses",
    ],
  },
  injectionOrder: {
    title: "Injection Order",
    description:
      "When multiple prompts share the same position (or same depth), this number decides which one appears first in the composition.",
    bullets: [
      "Lower number appears earlier (closer to the top)",
      "Higher number appears later (closer to the chat)",
      "Default is 100 - use gaps (10, 20, 30) for easy reordering",
    ],
  },
  placement: {
    title: "Placement",
    description:
      "Relative keeps the prompt in preset order. In-Chat injects it as its own message at a depth in chat history. Append glues its content onto the end of an existing message at that depth. Append Preset pins it to the very bottom of the assembled prompt; Prepend Preset pins it to the very top.",
  },
  injectionDepth: {
    title: "Injection Depth",
    description:
      "How many messages from the END of the chat to insert this prompt. Counted backwards from your latest message.",
    bullets: [
      "Depth 0 = right before your current message (strongest recency)",
      "Depth 1 = one message back from the end",
      "Higher depth = further from the AI's attention",
    ],
  },
  systemPrompt: {
    title: "System Prompt Flag",
    description:
      "Marks this as a system prompt for APIs that handle them specially (like Claude's system parameter).",
    bullets: ["Some APIs have dedicated system channels", "Improves instruction following"],
  },
  marker: {
    title: "Marker",
    description:
      "Special identifier for this prompt. The engine uses it to find and position certain prompts (persona, scenario, character definition).",
  },
} satisfies Record<string, FieldHelp>;

/** Flatten a help entry into a native-title string (title, description, then bullets). */
export function helpText(h: FieldHelp): string {
  const lines = [h.title, h.description];
  if (h.bullets) for (const b of h.bullets) lines.push(`- ${b}`);
  return lines.join("\n");
}
