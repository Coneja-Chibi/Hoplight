/**
 * A path YOU wrote is permission for that file.
 *
 * The folder grants exist so the MODEL cannot wander the disk. That is right for a model and wrong
 * for a person: somebody who pastes a path and says "look at this" has already said which file they
 * mean, and being sent to a sharing command first reads as an arbitrary step - because it is one.
 * This mints the narrowest possible authority for exactly what they named.
 *
 * ONE FILE, never the folder around it. And only from text the person submitted, never from anything
 * the model produced, which is the line that keeps this consent rather than a hole.
 */
import { stat } from "node:fs/promises";
import { pastedPaths } from "./primitives/composer/pasted-path";

/** The sharing seam this needs, narrowed to the two calls it makes. */
export interface GrantFolders {
  share(path: string): Promise<{ ok: boolean; already?: boolean }>;
  shareFile(path: string): Promise<{ ok: boolean; already?: boolean }>;
}

/** Told about a path that became a grant, so the shell can show it as its own clickable row. */
export type GrantNotice = (grant: { path: string; directory: boolean }) => void;

/**
 * Mint a grant for every path in submitted text. Fire-and-forget by design: a path that turns out
 * not to exist simply never becomes a grant, and the turn carries on either way.
 */
export function grantPastedPaths(value: string, folders: GrantFolders, notice: GrantNotice): void {
  for (const found of pastedPaths(value)) {
    // THE FILESYSTEM DECIDES which kind of grant this is, not the shape of the string. Guessing from
    // the text is what made the first version refuse a folder somebody had plainly handed over. A
    // file grants only itself; a folder grants reading inside it. Both are read-only, session-local,
    // and revocable with /unshare.
    void (async () => {
      // LONGEST READING FIRST. An unquoted path may contain spaces - `...\OpenAI Settings` - and
      // nothing in the text says where it ends. The filesystem does, so each candidate is stat'd
      // longest-first and the first that exists wins.
      for (const candidate of [...found.longer, found.path]) {
        const info = await stat(candidate).catch(() => null);
        if (!info) continue;
        const directory = info.isDirectory();
        const outcome = directory ? await folders.share(candidate) : await folders.shareFile(candidate);
        if (outcome.ok && !outcome.already) notice({ path: candidate, directory });
        return;
      }
      // Nothing matched: a word that merely looked like a path is not an error. Somebody mid-sentence
      // should never be told off for it.
    })();
  }
}
