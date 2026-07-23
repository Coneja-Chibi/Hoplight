/**
 * The pure ReAct core: drive one user turn by calling the injected model, dispatching the tool calls
 * it asks for, feeding results back, and repeating until it answers or a stop condition trips. There
 * is no I/O here, the model call and tool dispatch are injected, so this runs and is tested without a
 * network or a real model. It yields events for the render layer and returns the updated history.
 */
import type { ChatFn, ModelMessage, ModelToolCall, ToolSpec } from "../providers/provider";
import { callKey, stopReason } from "./stop-core";

/** The outcome of running one tool call: a one-line row for the terminal, plus the model's observation. */
export interface DispatchResult {
  summary: string;
  output: string;
}

/** Parse-and-run one tool call. Impure (touches the studio); injected so the core stays pure. */
export type DispatchFn = (call: ModelToolCall) => Promise<DispatchResult>;

/** What the render layer paints as a turn unfolds. */
export type LoopEvent =
  | { type: "say"; text: string }
  | { type: "tool"; name: string; summary: string }
  | { type: "stopped"; reason: string };

export interface LoopDeps {
  chat: ChatFn;
  dispatch: DispatchFn;
  tools: ToolSpec[];
  maxSteps: number;
}

/** Run one user turn to completion, yielding events and returning the turn's full message history. */
export async function* runTurn(
  input: string,
  history: readonly ModelMessage[],
  deps: LoopDeps,
): AsyncGenerator<LoopEvent, ModelMessage[]> {
  const messages: ModelMessage[] = [...history, { role: "user", content: input }];
  const recentCallKeys: string[] = [];

  for (let step = 0; ; step += 1) {
    const reason = stopReason({ step, maxSteps: deps.maxSteps, recentCallKeys });
    if (reason) {
      yield { type: "stopped", reason };
      return messages;
    }

    const reply = await deps.chat(messages, deps.tools);

    if (reply.kind === "say") {
      messages.push({ role: "assistant", content: reply.text });
      yield { type: "say", text: reply.text };
      return messages;
    }

    // reply.kind === "use": the model wants tools. Record the assistant turn with its calls so an
    // adapter can rebuild proper tool_use/tool_result pairs on the next round.
    messages.push({ role: "assistant", content: reply.text, toolCalls: reply.calls });
    if (reply.text) yield { type: "say", text: reply.text };

    for (const call of reply.calls) {
      const result = await deps.dispatch(call);
      messages.push({
        role: "tool",
        content: result.output,
        toolCallId: call.id,
        toolName: call.name,
      });
      recentCallKeys.push(callKey(call.name, call.args));
      yield { type: "tool", name: call.name, summary: result.summary };
    }
  }
}
