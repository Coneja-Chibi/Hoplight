/**
 * What the composer is asking for while somebody types a slash line.
 *
 * TWO STAGES, because a command word and its argument are different questions. `/ga` wants the list
 * of commands; `/gates gu` wants the list of MODES, which only the command itself knows. Kit's popup
 * makes the same split, and the second half is the one that matters: the popup used to complete the
 * command and then stop dead, leaving a person to type a preset id exactly, from memory.
 *
 * Pure and total. The argument candidates come from the server, because `complete()` is code on
 * disk; everything about WHEN to ask and what to insert afterwards is decided here, where it can be
 * tested without a network.
 */
import { nearestCommand } from "../../kit/commands/command";
import { asKitCommands, type CommandInfo } from "./command-core";

/** What the draft is currently asking for. */
export interface SlashQuery {
  /** The command word, including its slash, as typed so far. */
  readonly word: string;
  /**
   * The argument typed after the word, or null while the word itself is still being typed.
   *
   * Null and "" are different states and the difference is a single space: `/gates` is somebody who
   * may still be typing `/gateway`, and `/gates ` is somebody who has committed to the command and
   * wants to know what goes next.
   */
  readonly arg: string | null;
}

/**
 * Read the draft as a slash query, or null when it is not one.
 *
 * A DRAFT WITH A NEWLINE IS PROSE. Somebody writing a paragraph that happens to begin with a path is
 * not asking for a command menu, and popping one open over the second line of their message would be
 * the composer arguing with them.
 *
 * `//` is Kit's escape for a message that genuinely starts with a slash, so it is never a query.
 */
export function slashQuery(draft: string): SlashQuery | null {
  if (draft.includes("\n")) return null;
  // Only leading whitespace is forgiven, matching what matchCommand trims before it looks.
  const text = draft.replace(/^\s+/, "");
  if (!text.startsWith("/") || text.startsWith("//")) return null;
  const space = text.search(/\s/);
  if (space === -1) return { word: text.toLowerCase(), arg: null };
  return { word: text.slice(0, space).toLowerCase(), arg: text.slice(space + 1) };
}

/**
 * The commands a half-typed word could still become.
 *
 * PREFIX ONLY, on the name and on every alias. A popup that also matched anywhere in the word would
 * offer `/unshare` while somebody types `/share`, which is the one pair where picking the wrong row
 * undoes what they meant to do.
 */
export function commandMatches(
  catalog: readonly CommandInfo[],
  word: string,
): CommandInfo[] {
  const needle = word.replace(/^\/+/, "").toLowerCase();
  if (!needle) return [...catalog];
  const hits = (info: CommandInfo, names: readonly string[]): boolean =>
    names.some((n) => n.replace(/^\/+/, "").toLowerCase().startsWith(needle)) && info.name !== "";
  const byName = catalog.filter((info) => hits(info, [info.name]));
  // Alias hits come after name hits: somebody typing `/f` should see `/folders` under the commands
  // actually called that before the ones merely reachable by it.
  const byAlias = catalog.filter(
    (info) => !byName.includes(info) && hits(info, info.aliases ?? []),
  );
  return [...byName, ...byAlias];
}

/** The command a word IS, rather than one it could become. Aliases count: `/q` is `/quit`. */
export function exactCommand(
  catalog: readonly CommandInfo[],
  word: string,
): CommandInfo | undefined {
  const typed = word.toLowerCase();
  return catalog.find((info) => info.name === typed || info.aliases?.includes(typed));
}

/**
 * What the popup offers while the command WORD is being typed.
 *
 * A FINISHED WORD CLOSES THE LIST, and this is not a nicety. With `/resume` typed in full the popup
 * still offered `/resume`, so Enter completed it to what it already was instead of running it - the
 * command could be typed perfectly and never sent, which is the same dead end as not having commands
 * at all. There is nothing left to complete once the word is complete; a space moves to the argument
 * stage, which is the only thing still worth offering.
 */
export function wordStageChoices(
  catalog: readonly CommandInfo[],
  word: string,
): CommandInfo[] {
  return exactCommand(catalog, word) ? [] : commandMatches(catalog, word);
}

/**
 * The draft after choosing a command from the list.
 *
 * A command that takes an argument keeps the cursor going with a trailing space, which is also what
 * moves the popup into its second stage. One that does not is left ready to send.
 */
export function draftForPick(info: CommandInfo): string {
  return info.completes ? `${info.name} ` : info.name;
}

/** The draft after choosing an argument candidate. Always ready to send. */
export function draftForArg(word: string, value: string): string {
  return `${word} ${value}`;
}

/**
 * What the popup offers while the ARGUMENT is being typed.
 *
 * A CANDIDATE IDENTICAL TO WHAT IS ALREADY TYPED IS NOT A SUGGESTION, and this is the same dead end
 * `wordStageChoices` closes, one level down: completing `/art ` to `/art adrian` left `adrian`
 * matching its own prefix, so the popup reopened on the finished answer and Enter completed it again
 * forever. Found in the real window, twice, because the two stages fail independently.
 */
export function argStageChoices<T extends { readonly value: string }>(
  candidates: readonly T[],
  arg: string,
): T[] {
  const typed = arg.trim();
  return candidates.filter((one) => one.value !== typed);
}

/**
 * What to say about a slash line that matches nothing.
 *
 * Kit's wording, from Kit's own `nearestCommand`, because being pointed at the list when a single
 * letter was wrong is the complaint that produced that function.
 */
export function unknownNote(catalog: readonly CommandInfo[], word: string): string {
  const near = nearestCommand(asKitCommands(catalog), word);
  return near
    ? `Unknown command: ${word}. Did you mean ${near.name}? It ${near.summary}.`
    : `Unknown command: ${word}. Try /help.`;
}

/**
 * The index a keypress moves the highlight to, wrapping at both ends.
 *
 * Wrapping rather than stopping, because the list is short and the arrow keys are how it is read:
 * a highlight that sticks at the bottom makes somebody reverse all the way back up to see the top.
 */
export function nextIndex(current: number, count: number, step: number): number {
  if (count <= 0) return 0;
  return (((current + step) % count) + count) % count;
}
