/**
 * Collections store - atomic write; missing file = none; corrupt file = none rather than a throw.
 *
 * Deliberately a SIBLING of SettingsStore rather than a key inside it. Settings are preferences the
 * shell owns and every read of them is cheap; collections are studio content that grows with the
 * folder, and hanging membership lists off the preferences schema would mean rewriting somebody's
 * theme and accent every time they dragged a piece into a group.
 *
 * MISSING AND CORRUPT ARE BOTH "NO COLLECTIONS", which is the one place this differs from settings.
 * Settings throws on a corrupt file because starting with the wrong theme is better than starting
 * with a lie about what somebody configured. Collections are additive: nothing in the studio depends
 * on them, so refusing to open the app over a bad grouping file would take the whole library down
 * for a feature the person could simply rebuild. The parser is fail-closed per collection anyway, so
 * the total loss case is a file that is not JSON at all.
 */
import { join } from "node:path";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import {
  type CollectionsFile,
  EMPTY_COLLECTIONS,
  parseCollections,
} from "./collections-shape";

export class CollectionsStore {
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly io: StudioFs = nodeStudioFs,
  ) {}

  private get file(): string {
    return join(this.dir, "collections.json");
  }

  async read(): Promise<CollectionsFile> {
    const text = await this.io.readText(this.file);
    if (text === null) return EMPTY_COLLECTIONS;
    try {
      return parseCollections(JSON.parse(text));
    } catch {
      return EMPTY_COLLECTIONS;
    }
  }

  private async write(next: CollectionsFile): Promise<CollectionsFile> {
    await this.io.mkdirp(this.dir);
    await this.io.writeAtomicReplace(this.file, JSON.stringify(next, null, 2));
    return next;
  }

  /**
   * Serialize every mutation so read-modify-write edits cannot interleave.
   *
   * The real race, and the reason this is not optional: adding two pieces to a collection quickly -
   * two clicks, or a click and an agent - has both reads see the same file and the second write
   * drop the first piece. Copied from SettingsStore, which learned it first.
   */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeTail.then(operation, operation);
    this.writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * Apply a pure edit from collections-shape to the file on disk.
   *
   * The store owns I/O and ordering; it owns NO rules about what a collection may be. Every decision
   * - slug uniqueness, no duplicate members, what a rename touches - lives in the pure core where it
   * can be tested without a filesystem.
   */
  edit(change: (current: CollectionsFile) => CollectionsFile): Promise<CollectionsFile> {
    return this.enqueue(async () => this.write(change(await this.read())));
  }

  /** Replace the whole file, parsed and normalised first. */
  save(raw: unknown): Promise<CollectionsFile> {
    return this.enqueue(() => this.write(parseCollections(raw)));
  }
}
