/**
 * Explicit tool-call scheduler: read-only batches may overlap while any draft, apply, or unknown
 * effect makes the complete provider batch execute serially. Results always retain provider order.
 */
import type { ModelToolCall } from "../providers/provider";
import type { ToolEffect } from "../tools/tool";
import type { DispatchFn, DispatchResult } from "./loop-core";

export interface ScheduledToolResult {
  call: ModelToolCall;
  result: DispatchResult;
}

export interface SchedulerDeps {
  dispatch: DispatchFn;
  effectFor(call: ModelToolCall): ToolEffect | undefined;
  onStart?: (call: ModelToolCall) => void;
}

const execute = async (
  call: ModelToolCall,
  deps: SchedulerDeps,
): Promise<ScheduledToolResult> => {
  deps.onStart?.(call);
  return { call, result: await deps.dispatch(call) };
};

/** Execute one provider-declared batch without ever reordering its observations. */
export async function scheduleToolCalls(
  calls: readonly ModelToolCall[],
  deps: SchedulerDeps,
): Promise<ScheduledToolResult[]> {
  const allReads = calls.every((call) => deps.effectFor(call) === "read");
  if (allReads) return Promise.all(calls.map((call) => execute(call, deps)));

  const results: ScheduledToolResult[] = [];
  for (const call of calls) results.push(await execute(call, deps));
  return results;
}
