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
import { packagedDropIns } from "../../packaged-drop-ins";

const isChannelFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_");

/** Load every drop-in channel under channels/, sorted by name for a stable order. */
const isChannel = (value: unknown): value is NotifyChannel => {
  const channel = value as Partial<NotifyChannel> | undefined;
  return typeof channel?.name === "string" && typeof channel.emit === "function";
};

export async function discoverChannels(dir?: string): Promise<NotifyChannel[]> {
  // A compiled binary has no folder to walk; see packaged-drop-ins.ts.
  const baked = dir === undefined ? packagedDropIns("notifyChannels") : null;
  if (baked) return baked.filter(isChannel);
  const base = dir ?? fileURLToPath(new URL("./channels", import.meta.url));
  const files = (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isChannelFile)
    .sort((a, b) => a.localeCompare(b));
  const channels: NotifyChannel[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(base, file)).href)) as { default?: NotifyChannel };
    if (isChannel(mod.default)) channels.push(mod.default);
  }
  return channels;
}
