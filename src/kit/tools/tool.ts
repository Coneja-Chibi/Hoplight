/**
 * The one canonical tool shape for Kit (hub-and-spoke). Every tool is a drop-in file in this
 * folder that default-exports a HarnessTool; discover.ts finds them like the format loader finds
 * adapters. Args arrive from the model and are therefore untrusted: the dispatcher parses them once
 * with `input` and fails closed before `execute` ever runs, so execute only ever sees valid args.
 */
import type { z } from "zod";
import type { KitBridge } from "../bridge";

/** What a tool is handed at dispatch time: the one engine seam, nothing else. */
export interface ToolContext {
  bridge: KitBridge;
}

/** A tool's outcome: a one-line row for the terminal, and the full observation for the model. */
export interface ToolResult {
  summary: string;
  output: string;
}

export interface HarnessTool<Input = unknown> {
  /** Stable id the model calls by; unique across the folder. */
  name: string;
  /** One or two sentences the model reads to decide when to reach for this tool. */
  description: string;
  /** Zod schema for the args; the single parse-once, fail-closed boundary. */
  input: z.ZodType<Input>;
  /** Run the tool over already-validated args. Read tools never mutate; write tools gate first. */
  execute(args: Input, ctx: ToolContext): Promise<ToolResult>;
}
