/**
 * The command loader: folders-as-schema for Kit's slash commands, the impure edge mirroring
 * tools/discover.ts exactly. Every `*.ts` here that default-exports a KitCommand is discovered; the
 * infra files (command.ts, discover.ts), shared "_" helpers, and tests are skipped. Adding a command
 * is dropping a file, nothing central to edit. Sorted for a stable order.
 */
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { KitCommand } from "./command";
import { packagedDropIns } from "../packaged-drop-ins";

const INFRA = new Set(["command.ts", "discover.ts"]);

const isCommandFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_") && !INFRA.has(name);

const commandFiles = async (root: string, suppliedRoot: boolean): Promise<string[]> => {
  const found: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const acceptsFiles = suppliedRoot || basename(dir) === "commands";
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (acceptsFiles && isCommandFile(entry.name)) found.push(path);
    }
  };
  await visit(root);
  return found.sort((a, b) => a.localeCompare(b));
};

const isCommand = (value: unknown): value is KitCommand => {
  const command = value as Partial<KitCommand> | undefined;
  return typeof command?.name === "string" && typeof command.run === "function";
};

/** Collect, rejecting duplicate names whichever path produced the list. */
function collect(candidates: readonly unknown[]): KitCommand[] {
  const commands: KitCommand[] = [];
  for (const candidate of candidates) {
    if (!isCommand(candidate)) continue;
    if (commands.some((existing) => existing.name === candidate.name)) {
      throw new Error(`commands: duplicate name ${candidate.name}`);
    }
    commands.push(candidate);
  }
  return commands;
}

/** Load every drop-in command directory under Kit, sorted by path and rejecting duplicate names. */
export async function discoverCommands(dir?: string): Promise<KitCommand[]> {
  // THIS IS KIT'S FIRST STARTUP CALL, and the reason a compiled binary died on launch: the walk below
  // reads the directory `import.meta.url` sits in, which does not exist inside a single-file
  // executable. See packaged-drop-ins.ts.
  const baked = dir === undefined ? packagedDropIns("commands") : null;
  if (baked) return collect(baked);
  const base = dir ?? fileURLToPath(new URL("..", import.meta.url));
  const files = await commandFiles(base, dir !== undefined);
  const loaded: unknown[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(file).href)) as { default?: KitCommand };
    loaded.push(mod.default);
  }
  return collect(loaded);
}
