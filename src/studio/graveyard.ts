/**
 * Graveyard store - atomic write; missing file = empty; corrupt file = empty rather than a throw.
 *
 * A SIBLING OF THE COLLECTIONS STORE, and for the same reasons: it holds studio CONTENT rather than
 * preferences, it grows, and hanging it off settings.json would mean rewriting somebody's theme
 * every time they buried a block.
 *
 * ONE DIFFERENCE FROM COLLECTIONS, and it is the important one. A collection is a view - lose it
 * and you have lost an opinion about pieces that still exist. A grave is the ONLY copy of a block
 * that has been taken out of its preset. So the write is serialised like everything else here, and
 * the read is tolerant per grave rather than per file: a single corrupt entry must not take the
 * hundred beside it.
 */
import { join } from "node:path";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import { EMPTY_GRAVEYARD, parseGraveyard, type GraveyardFile } from "./graveyard-shape";

export class GraveyardStore {
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly io: StudioFs = nodeStudioFs,
  ) {}

  private get file(): string {
    return join(this.dir, "graveyard.json");
  }

  async read(): Promise<GraveyardFile> {
    const text = await this.io.readText(this.file);
    if (text === null) return EMPTY_GRAVEYARD;
    try {
      return parseGraveyard(JSON.parse(text));
    } catch {
      return EMPTY_GRAVEYARD;
    }
  }

  private async write(next: GraveyardFile): Promise<GraveyardFile> {
    await this.io.mkdirp(this.dir);
    await this.io.writeAtomicReplace(this.file, JSON.stringify(next, null, 2));
    return next;
  }

  /**
   * Serialize every mutation so read-modify-write edits cannot interleave.
   *
   * THE RACE THAT MATTERS HERE: burying two blocks quickly - which is exactly how somebody clears
   * out a preset - has both reads see the same file and the second write drop the first block. In
   * a store that holds the only copy, that is not a lost edit; it is a lost block.
   */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeTail.then(operation, operation);
    this.writeTail = result.then(() => undefined, () => undefined);
    return result;
  }

  /** Apply a pure edit from graveyard-shape. The store owns I/O and ordering, never the rules. */
  edit(change: (current: GraveyardFile) => GraveyardFile): Promise<GraveyardFile> {
    return this.enqueue(async () => this.write(change(await this.read())));
  }
}
