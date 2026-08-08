/**
 * The resume render projection: a restored wire history becomes the transcript lines the screen shows.
 * This is the ONE place the sessions feature touches RenderLine, so it lives in the render subtree and
 * the sessions core stays free of view concerns. Lossy by design and by choice (the accepted open
 * question): timing, reasoning, and error styling are aliveness, not conversation, so a replay collapses
 * tool work into one folded backstage row and drops durations. Tolerant: a malformed message is skipped,
 * never thrown, so a partially-understood history still renders.
 */
import type { ModelMessage } from "../../providers/provider";
import type { RenderLine } from "../../render/turn-events";
import { truncateGraphemes } from "../../_shared/graphemes";

const ROLES: ReadonlySet<string> = new Set(["user", "assistant", "tool"]);

const isMessage = (value: unknown): value is ModelMessage => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return ROLES.has(record["role"] as string) && typeof record["content"] === "string";
};

const preview = (text: string, cap = 60): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  return truncateGraphemes(clean, cap);
};

const toolMove = (message: ModelMessage): string => {
  const name = message.toolName ?? "tool";
  const summary = preview(message.content);
  return summary ? `${name} · ${summary}` : name;
};

/** Rebuild transcript lines from restored messages. Tool results fold into one collapsed backstage
 * row; assistant text becomes a say line; user text becomes a you line. Unknown shapes are skipped. */
export const messagesToLines = (messages: readonly ModelMessage[]): RenderLine[] => {
  const lines: RenderLine[] = [];
  let moves: string[] = [];
  const seal = (): void => {
    if (moves.length === 0) return;
    lines.push({ role: "backstage", moves, seconds: 0, open: false });
    moves = [];
  };
  /**
   * A question restored but not yet answered, so the reply that follows can close it.
   *
   * ANSWERED IS DERIVED, NOT STORED. Whatever the person said next IS the answer, so a resumed
   * transcript can tell a finished question from one still waiting without keeping a second copy of
   * the reply that would then have to agree with the first.
   */
  let pendingAsk: { at: number } | null = null;

  for (const message of messages) {
    if (!isMessage(message)) continue;
    if (message.role === "tool") {
      /**
       * A QUESTION COMES BACK AS A QUESTION. It used to fold into the backstage cluster as one grey
       * line truncated to sixty characters, so resuming dropped you in front of something you could
       * read half of and could not answer at all - and a half-finished round set was unfinishable.
       */
      if (message.choices) {
        seal();
        pendingAsk = { at: lines.length };
        lines.push({
          role: "choices",
          question: message.choices.question,
          options: message.choices.options,
        });
        continue;
      }
      moves.push(toolMove(message));
      continue;
    }
    if (message.role === "user") {
      seal();
      const text = message.content.trim();
      if (text) {
        // What was said next closes the question above it, which is what stops a resumed transcript
        // presenting an already-answered panel as though it were still waiting.
        if (pendingAsk) {
          const open = lines[pendingAsk.at];
          if (open?.role === "choices") lines[pendingAsk.at] = { ...open, answered: text };
          pendingAsk = null;
        }
        lines.push({ role: "you", text });
      }
      continue;
    }
    // assistant: its final/preamble text seals any pending tool cluster, then speaks. Its tool calls
    // are represented by their results (folded above), so nothing is pushed for them here.
    const text = message.content.trim();
    if (text) {
      seal();
      lines.push({ role: "say", text });
    }
  }
  seal();
  return lines;
};
