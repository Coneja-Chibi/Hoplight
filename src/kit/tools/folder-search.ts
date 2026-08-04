/**
 * Look inside a folder the user has shared. Reading only, always.
 *
 * WHY THIS IS NOT A GENERAL FILE TOOL. It answers two questions and no others: what is in here, and
 * what does this one file contain. It cannot write, cannot delete, and cannot reach outside the
 * folders that were explicitly shared, because every path it touches goes through checkGrant first
 * and the resolved path is what gets used. A tool that could be talked into reading anywhere would
 * make the grant decorative.
 *
 * THE COMPANION TO THAT IS COPYING IN. When something here needs changing, it is brought into the
 * studio first and edited there under the ordinary draft, gate and receipt. So nothing outside the
 * studio is ever modified by any path, which is a stronger promise than asking permission each time.
 */
import { z } from "zod";
import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { HarnessTool } from "./tool";
import { checkGrantReal, grantFolder, type Grant } from "./_shared/grants";

/** Enough to see a preset or a card; small enough that a stray binary cannot flood the transcript. */
const MAX_READ_CHARS = 60_000;
const MAX_ENTRIES = 300;
const MAX_DEPTH = 4;

const input = z.strictObject({
  action: z.enum(["list", "read"]).default("list"),
  path: z.string().trim().min(1).max(400)
    .describe("a folder to list, or a file to read; must be inside a shared folder"),
  match: z.string().trim().max(120).optional()
    .describe("for list: only names containing this, case-insensitive"),
  extensions: z.array(z.string().trim().max(12)).max(8).optional()
    .describe("for list: only these extensions, e.g. [\"json\", \"png\"]"),
});

/** Every folder Kit may read: the studio always, plus whatever was shared this session. */
const allowed = (studioDir: string, grants?: readonly Grant[]): Grant[] =>
  [grantFolder(studioDir, "studio"), ...(grants ?? [])];

interface Found { path: string; bytes: number }

/**
 * Walk breadth-first to a bounded depth.
 *
 * Bounded because a shared folder can be a whole drive: an unbounded walk is a hang, and a hang in a
 * tool reads as Kit being broken rather than as the folder being large. Symlinks are not followed,
 * since following one is how a walk leaves the granted root without any path ever looking wrong.
 */
async function walk(root: string, depth: number): Promise<Found[]> {
  const found: Found[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (queue.length > 0 && found.length < MAX_ENTRIES) {
    const { dir, depth: at } = queue.shift()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable directory is not a failure of the search
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (at < depth) queue.push({ dir: full, depth: at + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        found.push({ path: full, bytes: (await stat(full)).size });
      } catch {
        /* vanished between readdir and stat */
      }
      if (found.length >= MAX_ENTRIES) break;
    }
  }
  return found;
}

const folderSearch: HarnessTool<z.infer<typeof input>> = {
  name: "folder_search",
  description:
    "List or read files in a folder the user has shared with Kit. Read-only and confined to shared "
    + "folders. Use it to find presets, cards or lorebooks that live outside the studio; to change "
    + "one, import it into the studio first.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "folder-search",
  async execute(args, ctx) {
    const check = await checkGrantReal(allowed(ctx.bridge.studioDir, ctx.grants), args.path);
    if (!check.ok) return { summary: `folder_search: ${check.reason}`, output: check.detail };

    let info;
    try {
      info = await stat(check.path);
    } catch {
      return { summary: "folder_search: not found", output: `Nothing at ${check.path}.` };
    }

    if (args.action === "read") {
      if (info.isDirectory()) {
        return {
          summary: "folder_search read: that is a folder",
          output: `${check.path} is a folder. Use action "list".`,
        };
      }
      const text = await Bun.file(check.path).text().catch(() => null);
      if (text === null) {
        return {
          summary: "folder_search read: not text",
          output: `${check.path} is not readable as text. It may be an image or an archive.`,
        };
      }
      const clipped = text.length > MAX_READ_CHARS;
      return {
        summary: `folder_search read ${info.size} bytes${clipped ? " (clipped)" : ""}`,
        output: JSON.stringify({
          path: check.path,
          bytes: info.size,
          clipped,
          content: clipped ? text.slice(0, MAX_READ_CHARS) : text,
        }),
      };
    }

    if (!info.isDirectory()) {
      return { summary: "folder_search list: that is a file", output: `Use action "read" for a file.` };
    }
    const wanted = new Set((args.extensions ?? []).map((e) => `.${e.replace(/^\./, "").toLowerCase()}`));
    const needle = args.match?.toLowerCase();
    const files = (await walk(check.path, MAX_DEPTH)).filter((file) => {
      if (wanted.size > 0 && !wanted.has(extname(file.path).toLowerCase())) return false;
      return !needle || file.path.toLowerCase().includes(needle);
    });
    return {
      summary: `folder_search list: ${files.length}${files.length >= MAX_ENTRIES ? "+" : ""} file(s)`,
      output: JSON.stringify({
        root: check.path,
        // Relative paths keep the output readable and make it obvious nothing outside the root was seen.
        files: files.map((file) => ({ path: relative(check.path, file.path), bytes: file.bytes })),
        truncated: files.length >= MAX_ENTRIES,
      }),
    };
  },
};

export default folderSearch;
