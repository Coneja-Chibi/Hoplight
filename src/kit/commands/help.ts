/**
 * /help: list every command, read from the registry so it can never drift from what's wired, grouped
 * into sections by each command's `group` (Setup / Session / Moving / Other) to match the wireframe's
 * segmented help. Grouping is inline here rather than reaching up into render/'s buildHelp: a command
 * must not depend on the render layer (hub-and-spoke). Pure formatting; the shell renders the markdown.
 */
import type { KitCommand } from "./command";

/** Known groups in render order, with their headings; unknown named groups sort in after, Other last. */
const KNOWN: ReadonlyArray<{ id: string; title: string }> = [
  { id: "setup", title: "Setup" },
  { id: "session", title: "Session" },
  { id: "moving", title: "Moving" },
];
const OTHER = "other";

const groupOf = (command: KitCommand): string => {
  const g = (command.group ?? "").trim().toLowerCase();
  return g === "" ? OTHER : g;
};

const titleOf = (id: string): string =>
  KNOWN.find((k) => k.id === id)?.title ?? (id === OTHER ? "Other" : id[0]!.toUpperCase() + id.slice(1));

/** The section ids to render, in order: known groups first, then unknown named (alpha), Other last. */
const orderedGroups = (present: ReadonlySet<string>): string[] => {
  const known = KNOWN.map((k) => k.id).filter((id) => present.has(id));
  const unknown = [...present]
    .filter((id) => id !== OTHER && !KNOWN.some((k) => k.id === id))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown, ...(present.has(OTHER) ? [OTHER] : [])];
};

const rowFor = (command: KitCommand): string => {
  const also =
    command.aliases && command.aliases.length > 0 ? ` (${command.aliases.join(", ")})` : "";
  return `- \`${command.name}${also}\` - ${command.summary}`;
};

const command: KitCommand = {
  name: "/help",
  aliases: ["/?"],
  summary: "list the commands",
  group: "moving",
  run: (ctx) => {
    const byGroup = new Map<string, KitCommand[]>();
    for (const c of ctx.commands) {
      const id = groupOf(c);
      const rows = byGroup.get(id);
      if (rows) rows.push(c);
      else byGroup.set(id, [c]);
    }
    const lines: string[] = ["**Commands**", ""];
    for (const id of orderedGroups(new Set(byGroup.keys()))) {
      const cmds = (byGroup.get(id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      if (cmds.length === 0) continue;
      lines.push(`**${titleOf(id)}**`);
      for (const c of cmds) lines.push(rowFor(c));
      lines.push("");
    }
    ctx.say(lines.join("\n").trimEnd());
  },
};

export default command;
