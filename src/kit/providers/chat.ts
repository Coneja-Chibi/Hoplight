/**
 * The chat hub: our loop's ChatFn, implemented over the AI SDK. It maps Kit's canonical message and
 * tool shapes to the SDK and back, so the loop and tools never learn the SDK exists. Tools are sent
 * WITHOUT an execute function, so the model's tool calls come back to us and our loop-core drives the
 * ReAct cycle, the SDK never takes the wheel.
 */
import { jsonSchema, streamText, tool, type ModelMessage as AiMessage, type TextPart, type ToolCallPart, type ToolSet } from "ai";
import type { ChatFn, ModelMessage, ModelReply, ModelToolCall, ToolSpec } from "./provider";
import type { ProviderConfig } from "./config";
import { buildModel } from "./adapters";
import { readUsage, type TokenUsage } from "./usage";
import { KIT_TOOL_PROTOCOL } from "./tool-protocol";

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
export function makeChat(config: ProviderConfig, abortSignal?: AbortSignal): ChatFn {
  return async (messages, tools, onDelta) => {
    const model = await buildModel(config);
    const cap = AbortSignal.timeout(HANG_CAP_MS);
    const result = streamText({
      model,
      system: KIT_TOOL_PROTOCOL,
      messages: messages.map(toAiMessage),
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
    return toReply(await result.text, await result.toolCalls, mapUsage(await result.usage));
  };
}

/** Kit message -> AI SDK message, preserving assistant tool calls and tool results. */
function toAiMessage(message: ModelMessage): AiMessage {
  if (message.role === "user") {
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

/** AI SDK result -> our ModelReply: a plain answer, or a request to run tools, carrying this call's usage. */
function toReply(
  text: string,
  toolCalls: ReadonlyArray<{ toolCallId: string; toolName: string; input: unknown }>,
  usage: TokenUsage,
): ModelReply {
  if (toolCalls.length === 0) {
    return { kind: "say", text, usage };
  }
  const calls: ModelToolCall[] = toolCalls.map((call) => ({
    id: call.toolCallId,
    name: call.toolName,
    args: call.input,
  }));
  return { kind: "use", text, calls, usage };
}
