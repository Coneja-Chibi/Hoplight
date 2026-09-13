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

/** Merge two schemas for the same property across union variants into the least restrictive
 * combination. The provider schema is guidance for the model; the tool's own Zod parse enforces
 * the real per-action constraints fail-closed at dispatch. A narrower bound here would advertise
 * valid calls as invalid (search.limit max 8 vs browse.limit max 25), and a schema-guided
 * provider could reject or avoid them before the Zod parse ever runs. */
function mergePropertySchema(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  if (a.type !== b.type) {
    // A genuinely polymorphic property: keep it visible, but unconstrained by type keywords.
    return { description: a.description ?? b.description };
  }
  const merged: Record<string, unknown> = { ...a };
  if (!merged.description && typeof b.description === "string") merged.description = b.description;
  for (const key of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"] as const) {
    const hasA = typeof a[key] === "number";
    const hasB = typeof b[key] === "number";
    if (hasA && hasB) {
      const take = key.startsWith("max") ? Math.max : Math.min;
      merged[key] = take(a[key] as number, b[key] as number);
    } else if (hasA || hasB) {
      // Unbounded in one variant: the least restrictive merged schema has no bound at all.
      delete merged[key];
    }
  }
  if (Array.isArray(a.enum) && Array.isArray(b.enum)) {
    merged.enum = [...new Set([...a.enum, ...b.enum])];
  } else if (Array.isArray(a.enum) || Array.isArray(b.enum)) {
    delete merged.enum;
  }
  if (a.pattern !== b.pattern) delete merged.pattern;
  if (a.format !== b.format) delete merged.format;
  return merged;
}

/** A provider tool schema must be a flat object at the root: OpenAI-compatible endpoints reject
 * bare `oneOf`/`anyOf`, which is exactly what Zod emits for unions and discriminated unions
 * (docs_query). Flatten object variants into one properties map so the model sees every field it
 * can send; shared properties merge least-restrictively so no valid per-action call looks invalid
 * to the provider. Per-action strictness stays in the tool's own Zod parse: dispatch parses args
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
      } else {
        properties[key] = mergePropertySchema(existing as Record<string, unknown>, p);
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
    // An external tool's contract is already JSON Schema; converting its permissive zod stand-in
    // instead would advertise "any object" and the model would guess every argument. See tool.ts.
    schema: tool.schemaOverride ?? providerSchema(tool.input),
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
