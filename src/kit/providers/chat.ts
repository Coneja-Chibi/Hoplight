/**
 * The chat hub: our loop's ChatFn, implemented over the AI SDK. It maps Kit's canonical message and
 * tool shapes to the SDK and back, so the loop and tools never learn the SDK exists. Tools are sent
 * WITHOUT an execute function, so the model's tool calls come back to us and our loop-core drives the
 * ReAct cycle, the SDK never takes the wheel.
 */
import { jsonSchema, streamText, tool, type ModelMessage as AiMessage, type ImagePart, type TextPart, type ToolCallPart, type ToolSet } from "ai";
import type { ChatFn, ModelMessage, ModelReply, ModelToolCall, ToolSpec } from "./provider";
import type { ProviderConfig } from "./config";
import { buildModel, spokeChat, spokeEchoesReasoning } from "./adapters";
import { readUsage, type TokenUsage } from "./usage";
import { KIT_TOOL_PROTOCOL } from "./tool-protocol";

/** The SDK's assistant reasoning part (not re-exported by `ai`): thinking text beside the reply. */
type ReasoningPart = { type: "reasoning"; text: string };

/** Map the AI SDK's ragged usage object into a clean TokenUsage. Field names have drifted across SDK
 * majors (promptTokens/inputTokens, cachedInputTokens/cacheReadInputTokens), so we read tolerantly and
 * let readUsage guard every count (undefined / NaN -> 0). The `unknown` cast is the raw-payload edge. */
function mapUsage(raw: unknown): TokenUsage {
  const u = (raw ?? {}) as Record<string, number | undefined>;
  return readUsage({
    input: u.inputTokens ?? u.promptTokens,
    output: u.outputTokens ?? u.completionTokens,
    total: u.totalTokens,
    reasoning: u.reasoningTokens,
    cacheRead: u.cachedInputTokens ?? u.cacheReadInputTokens,
    cacheWrite: u.cacheCreationInputTokens ?? u.cacheWriteInputTokens,
  });
}

// A whole turn (wait + stream) may never hang forever: generous, but finite.
const HANG_CAP_MS = 300_000;

/** Bind a ChatFn to a provider config; the abort signal wires Esc-to-interrupt through to the call.
 * Streams: text and reasoning fragments flow to onDelta as they arrive, then the final reply is
 * assembled exactly as before, so the loop stays turn-based while the screen feels alive. */
/**
 * `ambient` is read PER TURN, never captured once: the rail changes while a conversation is running,
 * and a line describing where it was when the session started is the same wrong answer in a nicer
 * format.
 */
export function makeChat(
  config: ProviderConfig,
  abortSignal?: AbortSignal,
  ambient?: () => string,
): ChatFn {
  return async (messages, tools, onDelta) => {
    // A spoke that is not an HTTP model supplies its own chat. Asked first, because building a model
    // for it would mean inventing a request shape it never makes.
    const own = await spokeChat(config, abortSignal);
    if (own) return own(messages, tools, onDelta);
    const model = await buildModel(config);
    // Only the active spoke decides whether thinking must travel back; see ProviderSpoke.reasoningEcho.
    const echoReasoning = await spokeEchoesReasoning(config);
    const cap = AbortSignal.timeout(HANG_CAP_MS);
    const result = streamText({
      model,
      system: ambient ? `${KIT_TOOL_PROTOCOL}

${ambient()}` : KIT_TOOL_PROTOCOL,
      messages: messages.map((message) => toAiMessage(message, echoReasoning)),
      tools: toAiTools(tools),
      toolChoice: "auto",
      abortSignal: abortSignal ? AbortSignal.any([abortSignal, cap]) : cap,
    });
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") onDelta?.({ kind: "text", text: part.text });
      else if (part.type === "reasoning-delta") onDelta?.({ kind: "reasoning", text: part.text });
      else if (part.type === "error") {
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }
    return toReply(
      await result.text,
      await result.toolCalls,
      mapUsage(await result.usage),
      // Some backends insist the thought they produced comes back with the next turn; keep it.
      await result.reasoningText,
    );
  };
}

/** Kit message -> AI SDK message, preserving assistant tool calls and tool results. Reasoning is
 * attached only when the spoke DECLARED it must echo (reasoningEcho): for every other provider the
 * part is signature-gated (anthropic, google), folded into text (mistral), or silently dropped
 * (openai chat-completions), so the safe default is to leave it off the wire entirely. */
export function toAiMessage(message: ModelMessage, echoReasoning: boolean): AiMessage {
  if (message.role === "user") {
    /**
     * Images ride as PARTS beside the text, which is the shape every vision model takes.
     *
     * Reached only when something upstream decided this provider accepts them: attaching an image to
     * a text-only model is not a graceful degradation, it is a request that errors. The decision
     * belongs to the spoke that knows, not to the mapper that does not.
     */
    if (message.images && message.images.length > 0) {
      const parts: Array<TextPart | ImagePart> = [];
      if (message.content) parts.push({ type: "text", text: message.content });
      for (const image of message.images) parts.push({ type: "image", image });
      return { role: "user", content: parts };
    }
    return { role: "user", content: message.content };
  }
  if (message.role === "tool") {
    return {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: message.toolCallId ?? "",
          toolName: message.toolName ?? "",
          output: { type: "text", value: message.content },
        },
      ],
    };
  }
  if (message.reasoning && echoReasoning) {
    const parts: Array<ReasoningPart | TextPart | ToolCallPart> = [
      { type: "reasoning", text: message.reasoning },
    ];
    if (message.content) parts.push({ type: "text", text: message.content });
    for (const call of message.toolCalls ?? []) {
      parts.push({ type: "tool-call", toolCallId: call.id, toolName: call.name, input: call.args });
    }
    return { role: "assistant", content: parts };
  }
  if (message.toolCalls && message.toolCalls.length > 0) {
    const parts: Array<TextPart | ToolCallPart> = [];
    if (message.content) parts.push({ type: "text", text: message.content });
    for (const call of message.toolCalls) {
      parts.push({ type: "tool-call", toolCallId: call.id, toolName: call.name, input: call.args });
    }
    return { role: "assistant", content: parts };
  }
  return { role: "assistant", content: message.content };
}

/** Kit tool specs -> an AI SDK ToolSet with no execute, so calls return to our loop unrun. */
function toAiTools(specs: ToolSpec[]): ToolSet {
  const entries = specs.map((spec) => [
    spec.name,
    tool({ description: spec.description, inputSchema: jsonSchema(spec.schema) }),
  ] as const);
  return Object.fromEntries(entries);
}

/** AI SDK result -> our ModelReply: a plain answer, or a request to run tools, carrying this call's
 * usage and - when the backend thought aloud - the thinking text, for spokes that must replay it. */
export function toReply(
  text: string,
  toolCalls: ReadonlyArray<{ toolCallId: string; toolName: string; input: unknown }>,
  usage: TokenUsage,
  reasoning?: string,
): ModelReply {
  if (toolCalls.length === 0) {
    return { kind: "say", text, usage, reasoning };
  }
  const calls: ModelToolCall[] = toolCalls.map((call) => ({
    id: call.toolCallId,
    name: call.toolName,
    args: call.input,
  }));
  return { kind: "use", text, calls, usage, reasoning };
}
