/**
 * Is this review one block's text being rewritten?
 *
 * The diff pane is the right shape for exactly one situation: a single block whose CONTENT changed.
 * Everything else - reordering, toggling, three blocks at once, a rename - is better served by the
 * summary rows, which is what they are good at. Guessing wrong in either direction is worse than the
 * card we already have, so this refuses unless it is certain.
 *
 * The capability reports a block edit as one change carrying the whole prompts array before and
 * after, which is what makes this findable at all: the exact old and new text are already in the
 * review, and were only ever missing from the SCREEN.
 */

/** The one block that changed, with the text on both sides in full. */
export interface RewrittenBlock {
  readonly id: string;
  readonly name: string;
  readonly before: string;
  readonly after: string;
}

interface LooseChange {
  readonly path?: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

interface LoosePrompt {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly content?: unknown;
}

const asPrompts = (value: unknown): LoosePrompt[] | null =>
  Array.isArray(value) ? (value as LoosePrompt[]) : null;

const textOf = (prompt: LoosePrompt | undefined): string =>
  typeof prompt?.content === "string" ? prompt.content : "";

const idOf = (prompt: LoosePrompt): string | null =>
  typeof prompt.id === "string" && prompt.id.length > 0 ? prompt.id : null;

/**
 * The rewritten block, or null when this review is anything else.
 *
 * REFUSES ON AMBIGUITY. Two blocks changed, or a block also moved, or a name also changed, and this
 * returns null so the ordinary review rows are shown. A diff that quietly ignored a second change
 * would be worse than no diff: it would look complete.
 */
export function rewrittenBlock(changes: readonly LooseChange[]): RewrittenBlock | null {
  const edits = changes.filter((change) => change.path === "body.prompts");
  // One change only. Several means several operations, which the rows describe and this cannot.
  if (edits.length !== 1 || changes.length !== 1) return null;

  const before = asPrompts(edits[0]?.before);
  const after = asPrompts(edits[0]?.after);
  if (!before || !after) return null;
  // A different count means something was added or removed, not rewritten.
  if (before.length !== after.length) return null;

  let found: RewrittenBlock | null = null;
  for (let at = 0; at < after.length; at++) {
    const oldOne = before[at]!;
    const newOne = after[at]!;
    const id = idOf(newOne);
    // Order changed under us: position `at` is a different block on each side.
    if (id === null || id !== idOf(oldOne)) return null;
    if (newOne.name !== oldOne.name) return null;

    const oldText = textOf(oldOne);
    const newText = textOf(newOne);
    if (oldText === newText) continue;
    // A second differing block: the rows describe that, this cannot.
    if (found !== null) return null;
    found = {
      id,
      name: typeof newOne.name === "string" ? newOne.name : id,
      before: oldText,
      after: newText,
    };
  }
  return found;
}
