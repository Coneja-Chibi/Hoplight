#!/usr/bin/env bun
/**
 * The entry point a client spawns: Kit's tools, served on stdio.
 *
 * Started two ways, and the difference matters only here. Kit's Claude provider spawns it per turn so
 * the CLI can call home; a person can also register it once with their own client
 * (`claude mcp add --transport stdio hoplight -- hoplight mcp`) and use the studio from there.
 *
 * Diagnostics go to stderr without exception. stdout carries the protocol, and one stray line on it
 * is a malformed frame that ends the session.
 */
import { discoverTools } from "../kit/tools/discover";
import { makeDispatch, toolSpecs } from "../kit/loop/dispatch";
import { createBridge } from "../kit/bridge";
import { serve } from "./server";

const log = (message: string): void => {
  process.stderr.write(`hoplight-mcp: ${message}\n`);
};

async function main(): Promise<void> {
  const bridge = createBridge();
  const tools = await discoverTools();
  // The same dispatcher Kit's own loop uses, so a tool served here runs under exactly the rules it
  // runs under in Kit: its zod schema parses the arguments before execute ever sees them.
  const dispatch = makeDispatch(tools, { bridge });
  log(`serving ${tools.length} tools from ${bridge.studioDir}`);
  await serve({ tools: toolSpecs(tools), dispatch, log });
}

main().catch((error: Error) => {
  log(`could not start: ${error.message}`);
  process.exit(1);
});
