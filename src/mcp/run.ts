/**
 * Starting the MCP server: `hoplight mcp [studio-dir] [--read-only]`.
 *
 * Nothing here is a hardcoded tool list. The belt comes from discoverTools(), the same folders-as-schema
 * loader Kit's own loop uses, so a tool dropped into src/kit/tools appears to every connected client
 * with no edit here. The schemas come from the tools' own zod definitions. Adding a capability to Kit
 * adds it to every coding client that has this registered.
 *
 * TWO POSTURES, AND THE DIFFERENCE IS WHO HOLDS THE GATE.
 *
 * Registered by a person with their own client (`claude mcp add`, or the equivalent in Cursor, Zed,
 * Codex), the client asks before it runs a tool. That prompt is the gate, it belongs to the person
 * sitting there, and it is the reason the full belt is safe to offer: nothing runs that they did not
 * agree to. This is the default.
 *
 * Spawned by Kit for the Claude subscription provider, it is started with `--permission-mode
 * bypassPermissions`, because two gates asking about one call is worse than one. That turns the
 * client's prompt OFF, and Kit's own gate cannot reach across a process boundary, so that path has no
 * gate at all and must run read-only. It passes `--read-only` for exactly that reason.
 *
 * Getting this backwards in either direction is bad in a different way: read-only everywhere makes
 * the server useless for the coding work it exists to support, and writes everywhere means the
 * provider path can delete somebody's library with nobody asked.
 *
 * stdout carries protocol frames and nothing else. Diagnostics go to stderr, because one stray line
 * on stdout is a malformed frame and the client drops the session.
 */
import { createBridge } from "../kit/bridge";
import { discoverTools } from "../kit/tools/discover";
import { makeDispatch, toolSpecs } from "../kit/loop/dispatch";
import { readOnlyTools, serve } from "./server";

export interface McpRunOptions {
  /** Absolute studio path; defaults to the usual location. */
  readonly studioDir?: string;
  /**
   * Offer only `effect: "read"` tools. Set when nothing else will ask before a write runs, which
   * today means the provider spawn.
   */
  readonly readOnly?: boolean;
}

/** Serve until stdin closes. */
export async function runMcpServer(options: McpRunOptions = {}): Promise<void> {
  const bridge = createBridge(options.studioDir);
  const discovered = await discoverTools();
  const tools = options.readOnly ? readOnlyTools(discovered) : discovered;

  const log = (message: string): void => {
    process.stderr.write(`hoplight mcp: ${message}\n`);
  };
  log(
    options.readOnly
      ? `serving ${tools.length} read-only tools from ${bridge.studioDir}`
      : `serving ${tools.length} tools from ${bridge.studioDir};`
        + " your client asks before each one runs",
  );
  await serve({ tools: toolSpecs(tools), dispatch: makeDispatch(tools, { bridge }), log });
}
