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

/** A provider tool schema must be a flat object at the root: OpenAI-compatible endpoints reject
 * bare `oneOf`/`anyOf`, which is exactly what Zod emits for unions and discriminated unions
 * (docs_query). Flatten object variants into one properties map so the model sees every field it
 * can send. Per-action strictness stays in the tool's own Zod parse: dispatch parses args
 * fail-closed against `tool.input`, so a looser provider shape can never admit an invalid call. */
export function providerSchema(input: z.ZodType): Record<string, unknown> {
  const schema = z.toJSONSchema(input) as Record<string, unknown>;
  if (typeof schema.type === "string") return schema;
  const variants = [
    ...(Array.isArray(schema.oneOf) ? (schema.oneOf as unknown[]) : []),
    ...(Array.isArray(schema.anyOf) ? (schema.anyOf as unknown[]) : []),
  ] as Record<string, unknown>[];
  if (variants.length === 0) return { ...schema, type: "object" };
  const properties: Record<string, unknown> = {};
  const requiredSets: string[][] = [];
  for (const variant of variants) {
    if (variant.type !== "object" || typeof variant.properties !== "object" || variant.properties === null) {
      return { ...schema, type: "object" };
    }
    const vProps = variant.properties as Record<string, unknown>;
    const vRequired = Array.isArray(variant.required) ? (variant.required as string[]) : [];
    if (vRequired.length > 0) requiredSets.push(vRequired);
    for (const [key, prop] of Object.entries(vProps)) {
      const p = prop as Record<string, unknown>;
      const existing = properties[key];
      if (!existing) {
        // Carry a discriminator `const` forward as an enum so the model sees every choice.
        if (typeof p.const === "string") {
          const { const: _discriminator, ...rest } = p;
          properties[key] = { ...rest, enum: [p.const] };
        } else {
          properties[key] = p;
        }
      } else if (typeof p.const === "string") {
        const merged = existing as Record<string, unknown>;
        const list = Array.isArray(merged.enum) ? [...(merged.enum as unknown[])] : [];
        if (!list.includes(p.const)) list.push(p.const);
        merged.enum = list;
      }
    }
  }
  // Only fields every variant requires stay required; per-action requirements are enforced by the
  // tool's own Zod parse at dispatch.
  const required = requiredSets.length > 0
    ? [...requiredSets[0]!].filter((key) => requiredSets.every((list) => list.includes(key)))
    : [];
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

/** Advertise the tools to the model: name, description, and a JSON schema for the args. */
export function toolSpecs(tools: HarnessTool[]): ToolSpec[] {
  assertUniqueToolNames(tools);
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: providerSchema(tool.input),
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
