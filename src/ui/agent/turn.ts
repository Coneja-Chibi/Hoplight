/**
 * What a line in the agent's transcript is.
 *
 * THIS USED TO HOLD `runTurn`, a request/response turn over a JSON POST. The streaming rewrite
 * replaced it: a POST can only carry a finished answer, so it could show no tokens as they arrived,
 * no tool call while it ran, and - decisively - it gave the dispatch loop no way to ASK anything,
 * which made the Gate unreachable and tools impossible.
 *
 * The old function and its tests are gone rather than kept beside the working path. A tested module
 * nothing calls reads as covered code and quietly rots; the tests that matter now live in
 * stream-turn.test.ts, against the transport that is actually used.
 */
import type { AskChoices } from "./kit-choice-core";
import type { KitWidget } from "./command-core";

export interface ChatLine {
  /**
   * `kit` is the SHELL talking: what a slash command drew, and nothing anybody said.
   *
   * IT IS A ROLE RATHER THAN A FLAG because of where it must not go. The send path posts the
   * conversation to the model, and a `/decks` listing folded in as an assistant message would be the
   * model reading back a receipt it never wrote as if it had. Roles are already what that filter
   * reads, so this is the field that keeps it out.
   */
  readonly role: "user" | "assistant" | "tool" | "kit";
  readonly text: string;
  /**
   * What a command drew, when it drew something other than a paragraph.
   *
   * ON THE LINE, like `choices`, and for the same reason: the widget and the line it belongs to are
   * one event, and re-deriving a doctor table by parsing the sentence beside it would be reading a
   * rendering back to recover data we already had.
   */
  readonly widget?: KitWidget;
  /**
   * The tool that produced this line, when it was one.
   *
   * Carried separately from the text because Kit colours a tool row by its VERB - cool for reads,
   * warm for writes, red for destructive - and re-deriving the verb by parsing the rendered summary
   * would be reading a sentence back to recover a fact we already had.
   */
  readonly tool?: string;
  /**
   * The question this tool call asked, when it was `ask_choice`.
   *
   * ON THE TOOL LINE, not a line of its own, because the call and the question are one event. The
   * shell renders FROM THIS and never from the sentence the model wrote beside it - the same
   * separation the tool itself relies on, so a model cannot offer a choice by merely claiming to
   * have offered one.
   */
  readonly choices?: AskChoices;
  /** What was sent in answer, once. An answered panel keeps its place but stops taking input. */
  readonly answered?: string;
  /**
   * Whether a long reply is showing its text. Undefined until somebody clicks, which is what lets
   * the newest-reply-is-open rule apply until an explicit toggle overrules it.
   */
  readonly open?: boolean;
}

/** What the provider endpoint reports about the model this window would reach. */
export interface TurnResult {
  readonly connected?: boolean;
  readonly reason?: string;
  readonly provider?: string;
  readonly model?: string;
}
