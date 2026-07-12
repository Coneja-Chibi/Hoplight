/**
 * Same-directory atomic publish for studio JSON files.
 * Keep-both: exclusive create (no replace). Overwrite: write temp then rename over target.
 */
import { open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { StudioValidationError } from "./errors";

export class StudioWriteError extends Error {
  readonly code = "studio_write" as const;
  constructor(message = "could not write file") {
    super(message);
    this.name = "StudioWriteError";
  }
}

export class StudioConflictError extends Error {
  readonly code = "studio_conflict" as const;
  constructor(message = "file already exists") {
    super(message);
    this.name = "StudioConflictError";
  }
}

const tmpName = (finalPath: string): string => {
  const dir = dirname(finalPath);
  const tag = randomBytes(8).toString("hex");
  return join(dir, `.tmp-${tag}.json`);
};

/** Write bytes to a new exclusive path (fail if exists). */
export async function writeExclusive(finalPath: string, body: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(finalPath, "wx");
    await handle.writeFile(body, "utf8");
    await handle.sync();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "EEXIST") throw new StudioConflictError();
    throw new StudioWriteError();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Windows can refuse rename-over-target with a transient share violation (EPERM/EACCES/EBUSY)
 * while another handle briefly holds the destination - a concurrent save of the SAME file (two
 * settings writes land together when a piece opens), the search indexer, a scanner. The temp is
 * ours alone, so retrying just the rename is idempotent and safe: bounded attempts (12, ~780ms
 * worst case - 6 was flake-prone under 24-way contention in the suite), linear backoff, then fail
 * closed. Live repro before the retry existed: 3 of 8 rapid settings saves 500 d. */
const RENAME_ATTEMPTS = 12;
const RETRYABLE_RENAME_CODES: ReadonlySet<string> = new Set(["EPERM", "EACCES", "EBUSY"]);

async function renameWithRetry(tmp: string, finalPath: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(tmp, finalPath);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code ?? "";
      if (attempt >= RENAME_ATTEMPTS || !RETRYABLE_RENAME_CODES.has(code)) throw e;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }
}

/** Atomic replace: temp sibling then rename over destination. */
export async function writeAtomicReplace(finalPath: string, body: string): Promise<void> {
  const tmp = tmpName(finalPath);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(tmp, "wx");
    await handle.writeFile(body, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await renameWithRetry(tmp, finalPath);
  } catch {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
    throw new StudioWriteError();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
