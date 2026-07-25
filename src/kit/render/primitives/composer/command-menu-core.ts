/**
 * Pure matching for the slash-command palette. Prefix matches on command names and aliases lead,
 * with summary matches as a forgiving fallback; results stay alphabetical and deterministic.
 */
import type { KitCommand } from "../../../commands/command";

export const matchingCommands = (
  commands: readonly KitCommand[],
  draft: string,
): KitCommand[] => {
  const query = draft.trim().toLowerCase();
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
