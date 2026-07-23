/**
 * The provider seam: the one vendor-agnostic shape the loop calls a model through (hub-and-spoke).
 * anthropic/openai/xai/local adapters all implement chat(); the loop never knows which is behind it.
 * Types only, so loop-core can import this without pulling in any transport (keeps the core pure).
 */

/** One message in the running conversation the model sees. */
export interface ModelMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  /** On an assistant turn that invoked tools: the calls it made (adapters render these as tool_use). */
  toolCalls?: ModelToolCall[];
  /** On a tool result: which call it answers, and the tool's name. */
  toolCallId?: string;
  toolName?: string;
}

/** A tool the model chose to call, with raw (untrusted) args parsed at dispatch, never here. */
export interface ModelToolCall {
  id: string;
  name: string;
  args: unknown;
}

/** One model turn: a final answer, or a request to run tools with an optional preamble. */
export type ModelReply =
  | { kind: "say"; text: string }
  | { kind: "use"; text: string; calls: ModelToolCall[] };

/** How a tool looks to the model: name, description, and a JSON-schema for its args. */
export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/** The model call the loop depends on; every provider spoke implements this. Injected into the loop. */
export type ChatFn = (messages: ModelMessage[], tools: ToolSpec[]) => Promise<ModelReply>;

/** A configured provider spoke reachable through chat(). */
export interface Provider {
  id: string;
  chat: ChatFn;
}
