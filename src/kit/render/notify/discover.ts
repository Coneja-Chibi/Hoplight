/**
 * The channel loader: folders-as-schema for Notify's escape-code emitters, the impure edge mirroring
 * commands/discover.ts and tools/discover.ts. Every `*.ts` under channels/ that default-exports a
 * NotifyChannel is discovered; tests and shared "_" helpers are skipped. Adding a channel is dropping
 * a file, nothing central to edit. Sorted for a stable order.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { NotifyChannel } from "./channel";

const isChannelFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

/** Load every drop-in channel under channels/, sorted by name for a stable order. */
export async function discoverChannels(dir?: string): Promise<NotifyChannel[]> {
  const base = dir ?? fileURLToPath(new URL("./channels", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isChannelFile)
    .sort((a, b) => a.localeCompare(b));
  const channels: NotifyChannel[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: NotifyChannel };
    const channel = mod.default;
    if (channel && typeof channel.name === "string" && typeof channel.emit === "function") {
      channels.push(channel);
    }
  }
  return channels;
}
