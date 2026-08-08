/**
 * The kinds of thing Kit can learn about itself.
 *
 * AN OPEN SET, ON PURPOSE. Four of these are borrowed from Prime Agent's continual harness, which is
 * a good design; the rest are Kit's own, and there will be more. Adding one is adding an entry here
 * rather than touching the store, the journal, the gate, or the review card - none of which know
 * what a kind means.
 *
 * WHAT A KIND IS NOT: a permission level. Every kind meets the same gate and the same review card.
 * Grading them would mean deciding in advance which self-edits deserve less scrutiny, and the one
 * published failure in this field - Prime Agent's agent turning its own refinement loop toward
 * building better cheating skills in Factorio - came from a loop nobody was watching at all.
 */

/** One thing Kit can write about itself. */
export interface HarnessKind {
  /** Stable id, used in storage and never shown raw. */
  readonly id: string;
  /** What it is called on the review card. */
  readonly label: string;
  /** One line: what writing one of these would mean. */
  readonly blurb: string;
}

/**
 * The registry.
 *
 * The first four are Prime Agent's, kept under their names so the prior art stays legible. The rest
 * are Kit's, and exist because Kit knows what a preset block or a regex set IS - which is the whole
 * advantage of a harness that lives inside the studio rather than beside it.
 */
export const HARNESS_KINDS: readonly HarnessKind[] = [
  {
    id: "memory",
    label: "memory",
    blurb: "a durable fact about you or this studio, carried into every future session",
  },
  {
    id: "prompt",
    label: "prompt note",
    blurb: "a standing instruction added to how Kit is asked to behave",
  },
  {
    id: "skill",
    label: "skill",
    blurb: "a procedure Kit worked out once and can follow again without re-deriving it",
  },
  {
    id: "subagent",
    label: "subagent",
    blurb: "a role Kit delegates to repeatedly, written down as its own brief",
  },
  {
    id: "block-pattern",
    label: "block pattern",
    blurb: "the shape you build a preset block in, reusable as a skeleton",
  },
  {
    id: "regex-starter",
    label: "regex starter",
    blurb: "the shape you build a regex set in, reusable when starting a new one",
  },
  {
    id: "studio-convention",
    label: "studio convention",
    blurb: "how YOUR studio is organised: naming, decks, where things belong",
  },
];

const BY_ID = new Map(HARNESS_KINDS.map((kind) => [kind.id, kind]));

/** The kind, or null for one nothing here defines. Callers refuse rather than inventing a default. */
export const harnessKind = (id: string): HarnessKind | null => BY_ID.get(id) ?? null;

/** Is this a kind Kit knows how to write? */
export const isHarnessKind = (id: string): boolean => BY_ID.has(id);
