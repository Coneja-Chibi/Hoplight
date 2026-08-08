/**
 * What Kit knows about itself, and how a proposal to change it is applied.
 *
 * Pure. The store writes files, the gate asks, the journal remembers; this decides what a proposal
 * MEANS, and refuses the ones that mean nothing.
 *
 * THE SHAPE IS PRIME AGENT'S, because theirs is good: versioned entries, an append-only journal, and
 * every change carrying its evidence. Two things are ours.
 *
 * OURS, ONE: THE GATE COMES FIRST. Their loop writes and journals, so you learn what it did to itself
 * by reading a log afterwards. Kit asks before, and the evidence field they already collect is
 * exactly what a review card needs - so this is not extra ceremony, it is an existing field moved
 * earlier in time.
 *
 * OURS, TWO: A REFUSAL IS RECORDED. Their journal has no "declined" outcome because nothing can
 * decline. Ours does, and it earns its place: without it Kit would propose the same rejected memory
 * every session, and being asked the same question forever is its own kind of broken.
 */
import { isHarnessKind } from "./harness-kinds";

export type HarnessScope = "local" | "global";
export type HarnessAction = "create" | "update" | "delete";

/** One thing Kit has written about itself. */
export interface HarnessEntry {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly content: string;
  /** `local` is this studio; `global` follows you everywhere. */
  readonly scope: HarnessScope;
  /** Bumped on every accepted update, so a rollback has something to name. */
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A change Kit wants to make to itself. Nothing is written until this passes the gate. */
export interface HarnessProposal {
  readonly action: HarnessAction;
  readonly kind: string;
  /** Required to update or delete; absent when creating. */
  readonly id?: string;
  readonly title?: string;
  readonly content?: string;
  readonly scope?: HarnessScope;
  /**
   * WHY, in Kit's own words, and required.
   *
   * This is the field the review card is built from, so a proposal that cannot say what happened to
   * justify itself cannot be shown, and therefore cannot be accepted.
   */
  readonly evidence: string;
  /** Undoing an earlier refinement, named by its event id. */
  readonly rollbackOf?: string;
}

/** What became of a proposal. */
export type HarnessOutcome = "applied" | "declined" | "failed";

/** One line of the journal. Append-only; the history is what makes rollback possible. */
export interface HarnessEvent {
  readonly id: string;
  readonly at: string;
  /** What in the session prompted this. */
  readonly trigger: string;
  /** One line per thing that changed, for a person reading the history later. */
  readonly changes: readonly string[];
  readonly evidence: string;
  readonly outcome: HarnessOutcome;
  readonly rollbackOf?: string;
}

/** Everything Kit has learned, in one scope. */
export interface HarnessState {
  readonly schema: 1;
  readonly entries: readonly HarnessEntry[];
}

export const emptyHarness = (): HarnessState => ({ schema: 1, entries: [] });

/** The longest a single entry may be. Past this it is not a note, it is a document. */
export const MAX_CONTENT = 2000;
/** How many entries one scope may hold, so the context cost of remembering stays bounded. */
export const MAX_ENTRIES = 200;

/** Why a proposal cannot be applied, in words a person reads. */
export type HarnessRefusal = string;

/**
 * Check a proposal against the state it would change.
 *
 * REFUSES RATHER THAN REPAIRS. A proposal missing its evidence, naming a kind nothing defines, or
 * pointing at an entry that is not there is a mistake upstream, and quietly fixing it would hide the
 * mistake and write something nobody asked for.
 */
export function refuseProposal(state: HarnessState, proposal: HarnessProposal): HarnessRefusal | null {
  if (proposal.evidence.trim().length === 0) {
    return "No evidence given, so there is nothing to review.";
  }
  if (!isHarnessKind(proposal.kind)) {
    return `Kit has no "${proposal.kind}" to write.`;
  }
  if (proposal.action === "create") {
    const title = proposal.title?.trim() ?? "";
    const content = proposal.content?.trim() ?? "";
    if (title.length === 0) return "A new entry needs a title.";
    if (content.length === 0) return "A new entry needs something in it.";
    if (content.length > MAX_CONTENT) {
      return `That is ${String(content.length)} characters; the limit is ${String(MAX_CONTENT)}.`;
    }
    if (state.entries.length >= MAX_ENTRIES) {
      return `This scope already holds ${String(MAX_ENTRIES)} entries. Something has to go first.`;
    }
    return null;
  }
  const target = proposal.id ? state.entries.find((entry) => entry.id === proposal.id) : undefined;
  if (!target) return `There is no entry called "${proposal.id ?? ""}" to change.`;
  if (proposal.action === "update") {
    const content = proposal.content?.trim() ?? "";
    if (content.length === 0) return "An update with no new content would change nothing.";
    if (content.length > MAX_CONTENT) {
      return `That is ${String(content.length)} characters; the limit is ${String(MAX_CONTENT)}.`;
    }
    if (content === target.content.trim() && (proposal.title?.trim() ?? target.title) === target.title) {
      // The same no-op that made the rail report a pending change it could not apply.
      return "That is what it already says.";
    }
  }
  return null;
}

/** The state after an ACCEPTED proposal, plus the lines the journal should record. */
export interface Applied {
  readonly state: HarnessState;
  readonly changes: readonly string[];
}

/**
 * Apply a proposal that has already been checked and allowed.
 *
 * `now` and `newId` are passed in rather than read: a harness that stamped itself from the clock
 * could not be tested, and the one thing this must be is inspectable.
 */
export function applyProposal(
  state: HarnessState,
  proposal: HarnessProposal,
  now: string,
  newId: string,
): Applied {
  if (proposal.action === "create") {
    const entry: HarnessEntry = {
      id: newId,
      kind: proposal.kind,
      title: proposal.title?.trim() ?? "",
      content: proposal.content?.trim() ?? "",
      scope: proposal.scope ?? "local",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return {
      state: { ...state, entries: [...state.entries, entry] },
      changes: [`added ${proposal.kind} "${entry.title}"`],
    };
  }

  if (proposal.action === "delete") {
    const gone = state.entries.find((entry) => entry.id === proposal.id);
    return {
      state: { ...state, entries: state.entries.filter((entry) => entry.id !== proposal.id) },
      changes: [`removed ${proposal.kind} "${gone?.title ?? proposal.id ?? ""}"`],
    };
  }

  const changes: string[] = [];
  const entries = state.entries.map((entry) => {
    if (entry.id !== proposal.id) return entry;
    const title = proposal.title?.trim() || entry.title;
    const content = proposal.content?.trim() ?? entry.content;
    if (title !== entry.title) changes.push(`renamed to "${title}"`);
    if (content !== entry.content) changes.push(`rewrote ${proposal.kind} "${title}"`);
    return { ...entry, title, content, version: entry.version + 1, updatedAt: now };
  });
  return { state: { ...state, entries }, changes };
}
