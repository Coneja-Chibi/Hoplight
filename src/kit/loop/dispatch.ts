/**
 * Dispatch: the bridge between the model's tool calls and our tools. It advertises the tools to the
 * model (name, description, JSON-schema args) and runs a call by parsing the args ONCE with the
 * tool's own schema, fail-closed, before execute ever sees them. Unknown tool, bad args, or a thrown
 * execute all come back as a tolerant result the model can read and recover from, never a crash.
 */
import { z } from "zod";
import type { HarnessTool, ToolContext } from "../tools/tool";
import type { DispatchFn, DispatchResult } from "./loop-core";
import type { ModelToolCall, ToolSpec } from "../providers/provider";

/** Refuse ambiguous registries before provider schemas or dispatch maps can disagree. */
export function assertUniqueToolNames(tools: readonly HarnessTool[]): void {
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`duplicate tool name "${tool.name}"`);
    }
    names.add(tool.name);
  }
}

/** Advertise the tools to the model: name, description, and a JSON schema for the args. */
export function toolSpecs(tools: HarnessTool[]): ToolSpec[] {
  assertUniqueToolNames(tools);
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: z.toJSONSchema(tool.input) as Record<string, unknown>,
  }));
}

/** A dispatcher over the tools: find by name, parse args fail-closed, then execute. */
export function makeDispatch(tools: HarnessTool[], ctx: ToolContext): DispatchFn {
  assertUniqueToolNames(tools);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return async (call: ModelToolCall): Promise<DispatchResult> => {
    const tool = byName.get(call.name);
    if (!tool) {
      return { summary: `${call.name}: unknown tool`, output: `There is no tool named "${call.name}".` };
    }
    const parsed = tool.input.safeParse(call.args);
    if (!parsed.success) {
      return { summary: `${call.name}: bad args`, output: `Invalid args for ${call.name}: ${parsed.error.message}` };
    }
    try {
      return await tool.execute(parsed.data, ctx);
    } catch (error) {
      return { summary: `${call.name}: failed`, output: `${call.name} failed: ${String(error)}` };
    }
  };
}
