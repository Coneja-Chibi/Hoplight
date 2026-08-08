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
import type { GraveyardFile } from "../../studio/graveyard-shape";
import type { ChangeSession } from "../changes/session";
import type { HoplightDocs } from "../docs/repository";
import type { ResultStore } from "../results/store";
import type { StudioExports } from "../../studio/exports";
import type { Grant } from "./_shared/grants";

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
  /** Folders the user has pointed Kit at this session. READ ONLY, always: a tool that writes must
   *  never accept a path from here, so anything Kit changes was copied into the studio first. */
  grants?: readonly Grant[];
  /**
   * What is on the rail RIGHT NOW, or null when nothing is.
   *
   * Kit could put a preset on the rail and had no way to look at it, so asked "which preset do I
   * have up?" it answered from memory of what it had opened - and was wrong the moment the person
   * opened a different one themselves, which is exactly what happened: the rail read Paramnesia and
   * Kit said Empty Base, confidently.
   *
   * A function rather than a value because the rail changes DURING a turn: a snapshot taken when the
   * context was built would be the same kind of stale answer, just harder to notice.
   */
  rail?: () => RailSnapshot | null;
  /**
   * What THIS app calls the place a preset opens: "the rail" in the terminal, "the Workbench" in the
   * desktop window.
   *
   * Here because a tool's words end up in front of a person, and one app's furniture is not the
   * other's. rail_open said "on the rail" wherever it ran, so in the window the model reported a
   * preset open on a column that does not exist there - and nothing had opened at all. Absent means
   * the terminal's word, which is what every existing transcript already says.
   */
  surface?: string;
  /**
   * The block graveyard: blocks taken out of a preset and kept rather than deleted.
   *
   * Its own seam rather than a bridge call, because it is not the studio's decks - a grave is a
   * drawer, not a shelf, and nothing should be able to reach it by listing pieces. Absent in a
   * session that has none, and the tools say so rather than pretending they buried something.
   */
  graveyard?: {
    read(): Promise<GraveyardFile>;
    edit(change: (current: GraveyardFile) => GraveyardFile): Promise<GraveyardFile>;
  };
  /** Injectable clock, so a burial's timestamp is not a thing tests have to work around. */
  now?: () => number;
}

/** The rail as a tool may read it: what is open, how big it is, and what is unsaved. */
export interface RailSnapshot {
  /** The studio id of the preset on the rail. */
  readonly presetId: string;
  /** Its display name. */
  readonly title: string;
  /** How many blocks it has, and how many are enabled. */
  readonly blocks: number;
  readonly enabled: number;
  /**
   * Edits made on the rail and NOT yet saved.
   *
   * Load-bearing rather than trivia: the studio copy and what the person is looking at differ by
   * exactly this much, so a tool reading the preset from storage is reading something they can see
   * is out of date. Saying the number is what stops Kit describing a file as though it were the
   * screen.
   */
  readonly pending: number;
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
  /**
   * What the warnings actually SAY.
   *
   * The projection carried only a count, so a draft could warn that applying an edit to a file
   * read through an adapter saves a Hoplight copy beside it, and the person confirming would see
   * "1 warning" and no words. A warning nobody can read is decoration on a decision.
   */
  warnings?: readonly string[];
}

/** A tool's outcome: a one-line row for the terminal, and the full observation for the model. */
export interface ToolResult {
  summary: string;
  output: string;
  /** Machine-readable lifecycle result; the loop uses it instead of guessing from prose. */
  outcome?: "draft" | "applied" | "stale" | "discarded" | "failed";
  /** A complete draft preview cues application-owned review instead of model-authored permission prose. */
  review?: DraftReview;
  /**
   * A piece the model is asking the shell to put on screen.
   *
   * Structured rather than prose for the same reason `review` is: a shell that had to read
   * "I have opened Paramnesia for you" out of a sentence would open the wrong thing eventually,
   * and a model that could open a view by SAYING it had would be able to lie by accident.
   */
  show?: { kind: string; id: string };
  /**
   * Options for the person to pick from, as DATA.
   *
   * The same argument `show` makes, applied to a question. Kit could already write "which one:
   * empty-base, paramnesia-vi-rc, paramnesia-vi-rc-converted" and leave somebody to read a
   * comma-separated wall and retype an exact id from it. Parsing that sentence back into buttons was
   * the obvious fix and the wrong one: a detector that fires on most prose turns SOME text into
   * controls and leaves the rest as words, so nobody can tell by looking which is which.
   *
   * So the model proposes data and the shell decides presentation - the same rule as everywhere else.
   * Picking one does not answer for the person: it fills the composer, so they can still edit it or
   * ignore it. A list that submitted on click would be a model choosing when to send.
   */
  choices?: {
    /** What is being asked, in the model's own words. */
    readonly question: string;
    readonly options: readonly { readonly value: string; readonly note?: string }[];
  };
  /** Machine-readable user decision from the Gate; never inferred from a blocked message. */
  gateDecision?: "denied" | "aborted" | "held";
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
  /**
   * Can this machine run it at all? Absent means yes.
   *
   * OFFERED IS A PROMISE. A tool in the belt reads as a thing that works, so one needing an
   * install nobody has costs a step to discover and a turn to recover from - which is exactly
   * how preset_verify ate a twelve-step turn and wrote nothing. Checked once when the session
   * is built, because an install does not appear halfway through a conversation.
   */
  available?: () => boolean | Promise<boolean>;
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
