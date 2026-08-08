/**
 * Materialize a built .lvbak into a real directory tree. Users unzip these archives before
 * importing them, and the spec treats a folder and a ZIP as the same archive behind one entry
 * source, so the directory-source tests need a folder built from the very same bytes as the ZIP.
 *
 * Test-support only: it writes into an OS temp directory and the caller removes it.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";

/** Names our own fixtures never produce, refused anyway so a bad builder cannot escape the root. */
const unsafeName = (name: string): boolean =>
  name.startsWith("/") ||
  name.includes("\\") ||
  name.includes("\0") ||
  name.split("/").includes("..");

/**
 * Unpack archive bytes into a fresh temp directory and return its path. Zero-length entries stay
 * zero-length files, because the format treats them as meaningful.
 */
export async function materializeLvbak(bytes: Uint8Array): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hoplight-lvbak-"));
  const files = unzipSync(bytes);
  for (const [name, data] of Object.entries(files)) {
    if (unsafeName(name)) throw new Error(`materializeLvbak: unsafe entry name ${name}`);
    const target = join(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  return root;
}

/** Remove a directory produced by materializeLvbak. Safe to call twice. */
export async function removeMaterialized(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
