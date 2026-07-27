/**
 * The one canonical tool shape for Kit (hub-and-spoke). Every tool is a drop-in file in this
 * folder that default-exports a HarnessTool; discover.ts finds them like the format loader finds
 * adapters. Args arrive from the model and are therefore untrusted: the dispatcher parses them once
 * with `input` and fails closed before `execute` ever runs, so execute only ever sees valid args.
 */
import type { z } from "zod";
import type {
  CapabilityDescriptor,
  CapabilityDomain,
  ContentKind,
} from "../../entities/capabilities";
import type { KitBridge } from "../bridge";
import type { ChangeSession } from "../changes/session";
import type { HoplightDocs } from "../docs/repository";
import type { ResultStore } from "../results/store";
import type { StudioExports } from "../../studio/exports";

/** What a tool is handed at dispatch time: the one engine seam, nothing else. */
export interface ToolContext {
  bridge: KitBridge;
  /** Session-local preview drafts; present in the live Kit dispatch context. */
  changes?: ChangeSession;
  /** Read-only access to the catalog-contained Hoplight documentation corpus. */
  docs?: HoplightDocs;
  /** Bounded, opaque session-local storage for oversized tool observations. */
  results?: ResultStore;
  /** Write access to the studio's exports folder. Separate from the bridge because an export is a
   *  one-way projection into another platform's wire, not canonical content. */
  exports?: StudioExports;
}

/** Structured preview handed from a draft tool to the application-owned review surface. */
export interface DraftReview {
  draftId: string;
  target: { kind: ContentKind; id: string };
  changes: readonly {
    label: string;
    before: unknown;
    after: unknown;
  }[];
  warningCount: number;
}

/** A tool's outcome: a one-line row for the terminal, and the full observation for the model. */
export interface ToolResult {
  summary: string;
  output: string;
  /** Machine-readable lifecycle result; the loop uses it instead of guessing from prose. */
  outcome?: "draft" | "applied" | "stale" | "discarded" | "failed";
  /** A complete draft preview cues application-owned review instead of model-authored permission prose. */
  review?: DraftReview;
  /** Machine-readable user decision from the Gate; never inferred from a blocked message. */
  gateDecision?: "denied" | "aborted";
}

export type ToolExposure = "direct" | "deferred" | "hidden";
export type ToolEffect = "read" | "draft" | "apply";
export type ToolActivity = "discovering";

export interface ToolDiscoveryMetadata {
  id: string;
  domain: Exclude<CapabilityDomain, "content">;
  kind?: ContentKind;
  area: string;
  action: string;
  summary: string;
  aliases: readonly string[];
  platforms: CapabilityDescriptor["platforms"];
}

export interface HarnessTool<Input = unknown> {
  /** Stable id the model calls by; unique across the folder. */
  name: string;
  /** One or two sentences the model reads to decide when to reach for this tool. */
  description: string;
  /** Whether the model sees this tool immediately, after discovery, or never. */
  exposure: ToolExposure;
  /** Explicit scheduler behavior. Never infer this from the tool name. */
  effect: ToolEffect;
  /** Optional lifecycle specialization when effect alone cannot name the visible work. */
  activity?: ToolActivity;
  /** Search metadata for a deferred non-content workflow. Direct tools may omit it. */
  discovery?: ToolDiscoveryMetadata;
  /** Zod schema for the args; the single parse-once, fail-closed boundary. */
  input: z.ZodType<Input>;
  /** Calls sharing a key serialize when the scheduler supports batching. */
  concurrencyKey(args: Input): string;
  /** Run the tool over already-validated args. Read tools never mutate; write tools gate first. */
  execute(args: Input, ctx: ToolContext): Promise<ToolResult>;
}
