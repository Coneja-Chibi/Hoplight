/** Shared harness for the loop tests: drive runTurn with scripted replies and a harmless dispatcher. */
import type { ChatFn, ModelReply } from "../../providers/provider";
import { runTurn, type DispatchFn, type LoopDeps, type LoopEvent } from "../loop-core";

export const drain = async <R>(gen: AsyncGenerator<LoopEvent, R>) => {
  const events: LoopEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, history: next.value };
};

export const okDispatch: DispatchFn = async (call) => ({
  summary: `${call.name} ok`,
  output: `result of ${call.name}`,
});

export const deps = (chat: ChatFn, over?: Partial<LoopDeps>): LoopDeps => ({
  chat,
  dispatch: okDispatch,
  toolSnapshot: () => [],
  effectFor: () => "read",
  maxSteps: 8,
  ...over,
});

export const scripted = (replies: ModelReply[]): ChatFn => {
  let index = 0;
  return async () => replies[Math.min(index++, replies.length - 1)] as ModelReply;
};
