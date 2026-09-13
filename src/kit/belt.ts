/**
 * Which discovered tools this machine can actually offer.
 *
 * OFFER ONLY WHAT THIS MACHINE CAN RUN. A tool in the belt reads as a thing that works.
 * preset_verify needs a SillyTavern or Marinara checkout; on a machine with neither it was still
 * offered, and the model spent a step finding out - after several more spent guessing a file path.
 * One turn, nothing written.
 *
 * WHERE THE ENGINES ARE IS PART OF THE SAME QUESTION, which is why the saved folders are loaded
 * here rather than left to each caller. `available()` takes no arguments by design (it is asked
 * once, about the machine, not about a request), so the answer has to already be true by the time
 * it is asked. Without this, somebody who pointed the studio window at their SillyTavern checkout
 * would still be told the terminal has no engine - one setting, two programs, two answers.
 *
 * Asked once when the session is built: an install does not appear halfway through a conversation.
 *
 * EXTERNAL MCP TOOLS JOIN HERE TOO, and their access entries travel WITH them. The safety resolver
 * classifies by exact name and refuses prefix trust, so the only honest way to admit tools whose
 * names are not known until connect time is to enumerate them at the same moment they enter the
 * belt - one function returning both halves means the belt and the trust list cannot drift, which
 * is the failure that made preset_copy_blocks permanently unusable at the danger floor.
 */
import { loadEngineRoots } from "../studio/engine-roots";
import { readMcpConfig } from "./mcp/config";
import { connectedMcpTools, syncMcpConnections } from "./mcp/connections";
import { externalHarnessTools } from "./mcp/external-tools";
import type { CatalogToolAccess } from "./tools/safety/access";
import type { HarnessTool } from "./tools/tool";

export interface AssembledBelt {
  readonly tools: HarnessTool<unknown>[];
  /** Exact-name access entries for the EXTERNAL tools; first-party names stay in the trust map. */
  readonly externalAccess: CatalogToolAccess[];
  /** What a session brief can honestly say went wrong: failed servers, malformed or colliding tools. */
  readonly notes: string[];
}

export async function offerableTools(
  discovered: readonly HarnessTool<unknown>[],
  studioDir: string,
): Promise<HarnessTool<unknown>[]> {
  await loadEngineRoots(studioDir);
  const asked = await Promise.all(
    discovered.map(async (tool) => ({
      tool,
      ok: tool.available === undefined || (await tool.available()),
    })),
  );
  return asked.filter((entry) => entry.ok).map((entry) => entry.tool);
}

/** The whole belt: first-party tools this machine can run, plus connected MCP servers' tools. */
export async function assembleBelt(
  discovered: readonly HarnessTool<unknown>[],
  studioDir: string,
): Promise<AssembledBelt> {
  const firstParty = await offerableTools(discovered, studioDir);
  /**
   * NEVER UNDER THE TEST RUNNER unless a test says so by name. Sessions are built in dozens of
   * tests against the REAL home (~/.hoplight is shared with the owner's actual setup - a scratch
   * studio dir does not isolate it), so the day a real server is configured, every `bun test`
   * would spawn it once per session-building test. HOPLIGHT_MCP=on is the explicit override the
   * one integration test that WANTS live connections uses.
   */
  const underTest = process.env["NODE_ENV"] === "test" && process.env["HOPLIGHT_MCP"] !== "on";
  if (underTest || process.env["HOPLIGHT_MCP"] === "off") {
    return { tools: firstParty, externalAccess: [], notes: [] };
  }
  const config = await readMcpConfig();
  const notes: string[] = [...config.rejected];
  if (config.servers.length === 0) {
    return { tools: firstParty, externalAccess: [], notes };
  }
  await syncMcpConnections(config.servers);
  const { tools: external, collisions } = externalHarnessTools(connectedMcpTools());
  for (const collision of collisions) notes.push(`mcp: dropped colliding tool ${collision}`);
  /**
   * `egress` by enumeration, never by prefix: each connected tool's exact folded name, listed at
   * the moment it joins. The danger tier that confirms at the Gate and can be allowed for a
   * session - which is what "another program runs this" should cost.
   */
  const externalAccess: CatalogToolAccess[] = external.map((tool) => ({ name: tool.name, access: "egress" }));
  return { tools: [...firstParty, ...external], externalAccess, notes };
}
