/**
 * Pure matching for the slash-command palette. Prefix matches on command names and aliases lead,
 * with summary matches as a forgiving fallback; results stay alphabetical and deterministic.
 */
import type { ArgSuggestion, KitCommand } from "../../../commands/command";

export const matchingCommands = (
  commands: readonly KitCommand[],
  draft: string,
): KitCommand[] => {
  /**
   * TRIM THE START ONLY. A TRAILING SPACE IS THE WHOLE SIGNAL.
   *
   * This trimmed both ends, which deleted the one character that says the command word is finished:
   * `/rail ` became `/rail`, sailed past the whitespace guard below, and kept the COMMAND popup open.
   * Since the argument popup only opens when the command popup is closed, the argument list could
   * never appear until a letter was typed after the space - and the person had already been shown a
   * menu that looked like it was doing something. Reported three times as "why is it not
   * autocompleting", and my earlier fixes were both further down the same path.
   *
   * A leading space is still meaningless and still trimmed, because nobody means anything by it.
   */
  const query = draft.replace(/^\s+/, "").toLowerCase();
  if (!query.startsWith("/") || /\s/.test(query)) return [];
  return commands
    .filter((command) => {
      if (command.name.startsWith(query)) return true;
      if (command.aliases?.some((alias) => alias.startsWith(query))) return true;
      return query.length > 1 && command.summary.toLowerCase().includes(query.slice(1));
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * The draft split into a command and the argument being typed after it, or null when the draft has
 * not got past the command word yet.
 *
 * The check `matchingCommands` makes with `/\s/.test(query)` is the same one, read the other way
 * round: the moment a space appears, the person has finished naming the command and started naming
 * its subject. Before the space the popup completes commands; after it, arguments. That gap is what
 * made `/rail empty-base` have to be typed out in full - a piece id, exactly, from memory, at the
 * point in the sentence where somebody is least likely to remember it.
 *
 * Only the FIRST space splits. A value may contain more (a folder path), and splitting on every
 * space would truncate the prefix and stop matching halfway through a name.
 */
export function argContext(
  commands: readonly KitCommand[],
  draft: string,
): { command: KitCommand; prefix: string } | null {
  if (!draft.startsWith("/")) return null;
  const at = draft.indexOf(" ");
  /**
   * A FINISHED COMMAND NAME OFFERS ITS ARGUMENTS, without waiting for a space.
   *
   * Typing `/rail` used to leave a one-row popup naming the command that had just been typed in
   * full, which tells the reader nothing they did not write themselves, and the presets only
   * appeared after a space nobody had a reason to press. The useful answer at that moment is what
   * comes NEXT.
   *
   * Only when the word is unambiguously one command. If a name is also the prefix of another
   * (`/rail` beside a hypothetical `/railway`), the choice between commands is still live and the
   * command popup keeps it.
   */
  if (at === -1) {
    const typed = draft.toLowerCase();
    const named = commands.find(
      (c) => c.name === typed || c.aliases?.some((alias) => alias === typed),
    );
    if (!named?.complete) return null;
    return matchingCommands(commands, draft).length > 1 ? null : { command: named, prefix: "" };
  }
  const word = draft.slice(0, at).toLowerCase();
  const command = commands.find(
    (c) => c.name === word || c.aliases?.some((alias) => alias === word),
  );
  if (!command?.complete) return null;
  return { command, prefix: draft.slice(at + 1) };
}

/**
 * Filter candidates against what has been typed.
 *
 * A prefix match ranks above a contained one: somebody typing `par` for `paramnesia-vi-rc` expects
 * it first, not below a piece that merely has "par" in the middle. Case-insensitive, because studio
 * ids are lowercase and nobody types them that way while mid-thought.
 */
export function matchingArgs(
  candidates: readonly ArgSuggestion[],
  prefix: string,
): ArgSuggestion[] {
  const query = prefix.trim().toLowerCase();
  if (query === "") return [...candidates];
  const starts: ArgSuggestion[] = [];
  const contains: ArgSuggestion[] = [];
  for (const candidate of candidates) {
    const value = candidate.value.toLowerCase();
    if (value.startsWith(query)) starts.push(candidate);
    else if (value.includes(query) || (candidate.note?.toLowerCase().includes(query) ?? false)) {
      contains.push(candidate);
    }
  }
  const byValue = (a: ArgSuggestion, b: ArgSuggestion): number => a.value.localeCompare(b.value);
  return [...starts.sort(byValue), ...contains.sort(byValue)];
}

/** Replace the argument in a draft with the chosen value, keeping the command word intact. */
export function applyArg(draft: string, value: string): string {
  const at = draft.indexOf(" ");
  return at === -1 ? `${draft} ${value}` : `${draft.slice(0, at)} ${value}`;
}
