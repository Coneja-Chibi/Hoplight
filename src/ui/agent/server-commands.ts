/**
 * Kit's slash commands, reachable from the window.
 *
 * THE CATALOG IS DISCOVERED, NEVER LISTED. `discoverCommands` walks every `commands/` folder under
 * src/kit - there are two, and the second one holds `/resume`, the command that started this - so a
 * file dropped into either shows up in the window with nothing edited here. A hand-kept list is the
 * exact drift this repo keeps paying for, and it is what hid four commands the last time somebody
 * wrote one out.
 *
 * `/rail` IS FILTERED, BY REQUEST. It is a preset outline pinned beside a terminal conversation, and
 * the window has no such column. Filtered by name AND aliases, so `/blocks` and `/outline` cannot
 * reach it by the side door.
 *
 * HOST-ONLY, enforced upstream in server.ts. Running a command reads the vault, the studio and the
 * gate policy, and can write a shared-folder grant or the gate file. A guest permitted to read a
 * shared studio has not been handed any of that.
 */
import { json } from "../server-security";
import { discoverCommands } from "../../kit/commands/discover";
import type { KitCommand } from "../../kit/commands/command";
import { matchCommand } from "../../kit/commands/command";
import { parseTurn } from "./server-agent";
import { studioBridge, studioSession } from "./turn-stream";
import { runKitCommand } from "./command-context";

/** The one command the window does not offer. Its aliases go with it. */
const WITHHELD = "/rail";

/** Discovery walks the disk; the answer does not change while the process runs. */
let catalogOnce: Promise<KitCommand[]> | null = null;

/** Every command this build has, minus the withheld one. */
export function windowCommands(): Promise<KitCommand[]> {
  catalogOnce ??= discoverCommands().then((all) => all.filter((command) => command.name !== WITHHELD));
  return catalogOnce;
}

/** For tests, which must not inherit a catalog built against another fixture. */
export function resetCommandCatalog(): void {
  catalogOnce = null;
}

/**
 * What the page needs to match and to offer: the word, its aliases, one line, and its section.
 *
 * `completes` rather than the completer itself, because a completer is a function that reads the
 * studio. The page learns THAT there is something to suggest and asks for the suggestions when
 * somebody has actually typed a space.
 */
export async function handleCommandList(): Promise<Response> {
  const commands = await windowCommands();
  return json({
    commands: commands.map((command) => ({
      name: command.name,
      ...(command.aliases && command.aliases.length > 0 ? { aliases: command.aliases } : {}),
      summary: command.summary,
      ...(command.group ? { group: command.group } : {}),
      completes: typeof command.complete === "function",
    })),
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A command line is one line. Kit's matcher trims, so anything past a newline is not the command. */
const MAX_LINE = 4_000;

interface CommandBody {
  readonly line: string;
  readonly messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[];
}

/**
 * Read the request once, here.
 *
 * THE CONVERSATION REUSES `parseTurn`'s CAPS. `/context` and `/export` are the two commands that
 * need to see what the window is holding, and inventing a second message parser with its own limits
 * would be a second authority over the same question - the defect these headers keep naming. An
 * absent or empty conversation is normal for a command, so only a non-empty one is parsed.
 */
export function parseCommandBody(body: unknown): { ok: true; value: CommandBody } | { ok: false; why: string } {
  if (!isRecord(body)) return { ok: false, why: "expected an object" };
  const line = body["line"];
  if (typeof line !== "string") return { ok: false, why: "line must be a string" };
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return { ok: false, why: "a command line starts with /" };
  if (trimmed.length > MAX_LINE) return { ok: false, why: "line too long" };
  if (trimmed.includes("\n")) return { ok: false, why: "a command is one line" };

  const raw = body["messages"];
  if (raw === undefined || (Array.isArray(raw) && raw.length === 0)) {
    return { ok: true, value: { line: trimmed, messages: [] } };
  }
  const parsed = parseTurn({ messages: raw });
  if (!parsed.ok) return { ok: false, why: parsed.why };
  return {
    ok: true,
    value: {
      line: trimmed,
      messages: parsed.value.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    },
  };
}

/** Run one command against Kit's own code and hand back what it did. */
export async function handleCommandRun(
  body: unknown,
  studioDir: string,
  signal?: AbortSignal,
): Promise<Response> {
  const parsed = parseCommandBody(body);
  if (!parsed.ok) return json({ error: parsed.why }, 400);

  const commands = await windowCommands();
  const outcome = await runKitCommand(
    { line: parsed.value.line, messages: parsed.value.messages, studioDir, ...(signal ? { signal } : {}) },
    commands,
  );
  if (!outcome.ok) return json({ error: outcome.why }, 404);
  return json({ effects: outcome.effects });
}

/**
 * The candidates for a command's ARGUMENT, from the command's own completer.
 *
 * A DELIBERATELY NARROWER CONTEXT than a run gets, and Kit already draws that line: completion
 * happens on a keystroke, so a completer may see the shelf and the shared folders and nothing else.
 * It cannot open a screen, start a turn, or write. A context that could would eventually be used to.
 */
export async function handleCommandComplete(body: unknown, studioDir: string): Promise<Response> {
  const parsed = parseCommandBody(body);
  if (!parsed.ok) return json({ error: parsed.why }, 400);

  const commands = await windowCommands();
  const matched = matchCommand(commands, parsed.value.line);
  // No suggestions is a normal answer, and so is "that is not a command". Neither is an error: this
  // fires while somebody is still typing, and a 404 per keystroke would be noise in a log.
  if (!matched?.command.complete) return json({ suggestions: [] });

  const bridge = studioBridge(studioDir);
  const session = await studioSession(studioDir);
  try {
    const found = await matched.command.complete(matched.arg, {
      pieces: async (kind: string) =>
        (await bridge.list(kind)).map((piece) => ({ id: piece.id, ...(piece.name ? { name: piece.name } : {}) })),
      ...(session.folders ? { folders: session.folders } : {}),
    });
    return json({
      suggestions: found.slice(0, 12).map((one) => ({
        value: one.value,
        ...(one.note ? { note: one.note } : {}),
      })),
    });
  } catch {
    // A completer that threw is a drop-in file failing, and it must cost the suggestions rather
    // than the composer somebody is typing into.
    return json({ suggestions: [] });
  }
}
