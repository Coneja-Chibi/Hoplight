/**
 * Starting the MCP server from a command line: `hoplight mcp [studio-dir]`.
 *
 * Lifted out of cli.ts because assembling the belt, the bridge and the dispatcher is one concept, and
 * because it is the same assembly main.ts performs. Two copies of it would drift, and the thing most
 * likely to drift is the read-only clamp, which is the part that must not.
 *
 * stdout carries protocol frames and nothing else. Every diagnostic goes to stderr, because one stray
 * line on stdout is a malformed frame and the client drops the session.
 */
import { createBridge } from "../kit/bridge";
import { discoverTools } from "../kit/tools/discover";
import { makeDispatch, toolSpecs } from "../kit/loop/dispatch";
import { readOnlyTools, serve } from "./server";

/** Serve until stdin closes. `studioDir` defaults to the usual studio location. */
export async function runMcpServer(studioDir?: string): Promise<void> {
  const bridge = createBridge(studioDir);
  // Read-only: this process has no access to Kit's permission gate, so it must not offer a write.
  const tools = readOnlyTools(await discoverTools());
  const log = (message: string): void => {
    process.stderr.write(`hoplight mcp: ${message}\n`);
  };
  log(`serving ${tools.length} read-only tools from ${bridge.studioDir}`);
  await serve({ tools: toolSpecs(tools), dispatch: makeDispatch(tools, { bridge }), log });
}
