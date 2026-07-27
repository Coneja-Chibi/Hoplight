/**
 * The exports folder: where a converted, foreign-format artifact lands.
 *
 * This is a SEPARATE authority from StudioStore on purpose. StudioStore owns canonical entities and
 * every one of its invariants (revisions, escrow, create-only compare) is about canonical content.
 * An export is not canonical: it is a one-way projection into somebody else's wire format, it has no
 * revision, and re-importing it is a fresh import rather than an update. Folding it into the store
 * would blur a boundary that is currently sharp.
 *
 * THE CALLER NEVER SUPPLIES A PATH. It supplies an entity id and a bare extension; the filename is
 * derived here and containment comes from `resolveStudioExportPath`, which runs the id through the
 * same safety check canonical storage uses and restricts the extension to a closed set. That is what
 * makes this safe to expose to a model: there is no path argument to point somewhere else.
 *
 * Writes are create-only. An export that silently overwrote an earlier one would destroy a file the
 * user may have already sent somewhere, and unlike a canonical piece there is no revision history to
 * recover it from.
 */
import { basename, dirname } from "node:path";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import { resolveStudioExportPath, STUDIO_EXPORTS_DIR } from "./path-policy";
import { StudioConflictError } from "./atomic-file";

export interface ExportReceipt {
  status: "written" | "exists";
  /** Absolute path on disk, for a human to open. */
  path: string;
  /** Path relative to the studio root, safe to show in a terminal without leaking a home directory. */
  relativePath: string;
  bytes: number;
}

export class StudioExports {
  constructor(
    private readonly root: string,
    private readonly io: StudioFs = nodeStudioFs,
  ) {}

  /**
   * Write one converted artifact. Returns `exists` rather than throwing when the name is taken, so
   * a caller can report a refusal as an ordinary outcome instead of an error.
   */
  async write(id: string, extension: string, body: string): Promise<ExportReceipt> {
    const path = resolveStudioExportPath(this.root, id, extension);
    const relativePath = `${STUDIO_EXPORTS_DIR}/${basename(path)}`;
    const bytes = new TextEncoder().encode(body).byteLength;
    await this.io.mkdirp(dirname(path));
    try {
      await this.io.writeExclusive(path, body);
      return { status: "written", path, relativePath, bytes };
    } catch (error) {
      if (error instanceof StudioConflictError) {
        return { status: "exists", path, relativePath, bytes };
      }
      throw error;
    }
  }
}
