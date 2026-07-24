/**
 * The command loader: folders-as-schema for Kit's slash commands, the impure edge mirroring
 * tools/discover.ts exactly. Every `*.ts` here that default-exports a KitCommand is discovered; the
 * infra files (command.ts, discover.ts), shared "_" helpers, and tests are skipped. Adding a command
 * is dropping a file, nothing central to edit. Sorted for a stable order.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { KitCommand } from "./command";

const INFRA = new Set(["command.ts", "discover.ts"]);

const isCommandFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_") && !INFRA.has(name);

/** Load every drop-in command in this folder, sorted by name for a stable order. */
export async function discoverCommands(dir?: string): Promise<KitCommand[]> {
  const base = dir ?? fileURLToPath(new URL(".", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isCommandFile)
    .sort((a, b) => a.localeCompare(b));
  const commands: KitCommand[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: KitCommand };
    const command = mod.default;
    if (command && typeof command.name === "string" && typeof command.run === "function") {
      commands.push(command);
    }
  }
  return commands;
}
