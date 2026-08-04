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
import { runMcpServer } from "./run";

const log = (message: string): void => {
  process.stderr.write(`hoplight-mcp: ${message}\n`);
};

async function main(): Promise<void> {
  // Full belt: whoever registered this server holds the gate, via their own client's prompt.
  // --read-only is for a caller that suppresses that prompt; see mcp/run.ts.
  await runMcpServer({ readOnly: process.argv.includes("--read-only") });
}

main().catch((error: Error) => {
  log(`could not start: ${error.message}`);
  process.exit(1);
});
