/**
 * The provider seam: the one vendor-agnostic shape the loop calls a model through (hub-and-spoke).
 * anthropic/openai/xai/local adapters all implement chat(); the loop never knows which is behind it.
 * Types only, so loop-core can import this without pulling in any transport (keeps the core pure).
 */
import type { TokenUsage } from "./usage";

/** One message in the running conversation the model sees. */
export interface ModelMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  /** On an assistant turn that invoked tools: the calls it made (adapters render these as tool_use). */
  toolCalls?: ModelToolCall[];
  /**
   * Images riding with a user message.
   *
   * Raw bytes, not a data URI: the adapter that sends them knows the shape its own SDK wants, and a
   * string here would mean encoding once for a provider that may not be asked and cannot use it.
   * Only ever attached when the active provider DECLARED it takes images, so this being non-empty is
   * already a statement that somebody can read them.
   */
  images?: readonly Uint8Array[];
  /** On a tool result: which call it answers, and the tool's name. */
  toolCallId?: string;
  toolName?: string;
  /**
   * A tool result that is a PANEL rather than prose, kept so a resumed session can draw it again.
   *
   * The observation text a model reads is a summary - "Asked: ...\nOptions offered: a, b, c" -
   * which drops every option's reason and cannot be turned back into something answerable. So a
   * resumed transcript folded a question into one truncated grey line with nothing to click, and
   * a half-finished round set was unfinishable.
   *
   * SHELL-ONLY. Every adapter maps a message field by field onto its provider's shape, so this
   * rides in storage and never onto a wire.
   */
  choices?: {
    question: string;
    options: readonly { value: string; note?: string }[];
  };
}

/** A tool the model chose to call, with raw (untrusted) args parsed at dispatch, never here. */
export interface ModelToolCall {
  id: string;
  name: string;
  args: unknown;
}

/** One model turn: a final answer, or a request to run tools with an optional preamble. `usage` is the
 * provider's reported token counts for this call (already cleaned), when it reported any; the meter and
 * tally read it. Optional: an OAI-compatible router that omits usage simply leaves it undefined. */
export type ModelReply =
  | { kind: "say"; text: string; usage?: TokenUsage }
  | { kind: "use"; text: string; calls: ModelToolCall[]; usage?: TokenUsage };

/** How a tool looks to the model: name, description, and a JSON-schema for its args. */
export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/** A live fragment of the model's turn, streamed as it arrives. "reasoning" is the model thinking
 * before it answers; "text" is the answer being typed. Pure data; the render layer decides the look. */
export interface ChatDelta {
  kind: "text" | "reasoning";
  text: string;
}

/** The model call the loop depends on; every provider spoke implements this. Injected into the loop.
 * onDelta (optional) receives live fragments while the reply forms, for typing/thinking feedback. */
export type ChatFn = (
  messages: ModelMessage[],
  tools: ToolSpec[],
  onDelta?: (delta: ChatDelta) => void,
) => Promise<ModelReply>;

/** A configured provider spoke reachable through chat(). */
export interface Provider {
  id: string;
  chat: ChatFn;
}
