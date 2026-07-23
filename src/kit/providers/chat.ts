/**
 * The chat hub: our loop's ChatFn, implemented over the AI SDK. It maps Kit's canonical message and
 * tool shapes to the SDK and back, so the loop and tools never learn the SDK exists. Tools are sent
 * WITHOUT an execute function, so the model's tool calls come back to us and our loop-core drives the
 * ReAct cycle, the SDK never takes the wheel.
 */
import { generateText, jsonSchema, tool, type ModelMessage as AiMessage, type TextPart, type ToolCallPart, type ToolSet } from "ai";
import type { ChatFn, ModelMessage, ModelReply, ModelToolCall, ToolSpec } from "./provider";
import type { ProviderConfig } from "./config";
import { buildModel } from "./adapters";

/** Bind a ChatFn to a provider config; the abort signal wires Esc-to-interrupt through to the call. */
export function makeChat(config: ProviderConfig, abortSignal?: AbortSignal): ChatFn {
  return async (messages, tools) => {
    const model = await buildModel(config);
    const result = await generateText({
      model,
      messages: messages.map(toAiMessage),
      tools: toAiTools(tools),
      toolChoice: "auto",
      abortSignal,
    });
    return toReply(result.text, result.toolCalls);
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

/** AI SDK result -> our ModelReply: a plain answer, or a request to run tools. */
function toReply(
  text: string,
  toolCalls: ReadonlyArray<{ toolCallId: string; toolName: string; input: unknown }>,
): ModelReply {
  if (toolCalls.length === 0) {
    return { kind: "say", text };
  }
  const calls: ModelToolCall[] = toolCalls.map((call) => ({
    id: call.toolCallId,
    name: call.toolName,
    args: call.input,
  }));
  return { kind: "use", text, calls };
}
