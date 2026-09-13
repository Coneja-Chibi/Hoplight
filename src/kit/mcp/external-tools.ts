/**
 * External MCP tools, worn as Kit tools.
 *
 * NAMED `mcp_<server>_<tool>`, exact and enumerable. The safety doctrine refuses prefix trust, so
 * these names are not classified by their prefix: session build enumerates the connected tools and
 * hands each EXACT name to the access resolver as `egress` - the danger tier that confirms at the
 * Gate and can be allowed for a session, which is precisely what "another program runs this" should
 * cost. Nothing external ever reaches the belt without appearing in that enumeration.
 *
 * THE FAR SERVER IS THE VALIDATOR. `input` is a permissive object schema on purpose: the tool's real
 * contract is the JSON Schema the server advertised (carried to the model via schemaOverride), and
 * rejecting here what the server would accept would invent a second authority over somebody else's
 * tool. What dispatch's parse still guarantees is the only thing it can: the arguments are an object.
 *
 * EFFECT IS "apply", because the honest answer is "we cannot know". A read-shaped external tool that
 * was labelled read here would skip every ask; labelled apply, the worst case is a confirmation that
 * was not strictly needed. The asymmetry decides it.
 */
import { z } from "zod";
import type { McpTool } from "../../mcp/protocol";
import { callMcpTool } from "./connections";
import type { HarnessTool } from "../tools/tool";

/** MCP tool names may carry characters Kit's belt never uses; fold them to the belt's alphabet. */
const foldName = (raw: string): string => raw.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

export const externalToolName = (serverId: string, tool: string): string =>
  `mcp_${foldName(serverId)}_${foldName(tool)}`;

const input = z.record(z.string(), z.unknown());

/** Keep external observations under the same bounded contract as first-party reads. */
function boundedOutput(ctx: Parameters<HarnessTool["execute"]>[1], label: string, content: string): string {
  if (!ctx.results) return content.slice(0, 4_096);
  try {
    const captured = ctx.results.capture(label, content);
    return captured.spilled ? JSON.stringify(captured) : captured.content;
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "external result exceeded the bounded store",
      omitted: true,
    });
  }
}

/** One belt tool per advertised tool. Name collisions after folding keep the first and drop the rest, counted. */
export function externalHarnessTools(
  advertised: readonly { serverId: string; tool: McpTool }[],
): { tools: HarnessTool[]; collisions: string[] } {
  const tools: HarnessTool[] = [];
  const collisions: string[] = [];
  const taken = new Set<string>();
  for (const { serverId, tool } of advertised) {
    const name = externalToolName(serverId, tool.name);
    if (taken.has(name)) {
      collisions.push(`${serverId}/${tool.name} -> ${name}`);
      continue;
    }
    taken.add(name);
    tools.push({
      name,
      description: `[${serverId}] ${tool.description || tool.name}`.slice(0, 900),
      exposure: "direct",
      effect: "apply",
      input,
      schemaOverride: tool.inputSchema,
      // One call at a time per server: stdio replies are matched by id so parallel calls would
      // work, but external servers are of every quality and serial is the survivable default.
      concurrencyKey: () => `mcp/${serverId}`,
      async execute(args, ctx) {
        const outcome = await callMcpTool(serverId, tool.name, args as Record<string, unknown>);
        return {
          summary: `${name}: ${outcome.isError ? "failed" : "done"}`,
          output: boundedOutput(ctx, `mcp/${serverId}/${tool.name}`, outcome.text),
        };
      },
    });
  }
  return { tools, collisions };
}
