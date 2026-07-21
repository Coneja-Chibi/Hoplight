/**
 * Settings store - atomic write; missing file = defaults; corrupt/unreadable throws.
 */
import { join } from "node:path";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import { StudioReadError } from "./errors";
import { parseSettings, type StudioSettings, DEFAULT_SETTINGS } from "./settings-shape";

export class SettingsStore {
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly io: StudioFs = nodeStudioFs,
  ) {}

  private get file(): string {
    return join(this.dir, "settings.json");
  }

  async read(): Promise<StudioSettings> {
    const text = await this.io.readText(this.file);
    if (text === null) return { ...DEFAULT_SETTINGS };
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new StudioReadError("corrupt settings file");
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new StudioReadError("corrupt settings file");
    }
    return parseSettings(raw);
  }

  private async write(settings: StudioSettings): Promise<StudioSettings> {
    await this.io.mkdirp(this.dir);
    await this.io.writeAtomicReplace(this.file, JSON.stringify(settings, null, 2));
    return settings;
  }

  /** Serialize every settings mutation so read-modify-write patches cannot interleave. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeTail.then(operation, operation);
    this.writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  save(raw: unknown): Promise<StudioSettings> {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return Promise.reject(new StudioReadError("invalid settings payload"));
    }
    const settings = parseSettings(raw);
    return this.enqueue(() => this.write(settings));
  }

  update(raw: unknown): Promise<StudioSettings> {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return Promise.reject(new StudioReadError("invalid settings patch"));
    }
    const patch = raw as Record<string, unknown>;
    return this.enqueue(async () => {
      const current = await this.read();
      return this.write(parseSettings({ ...current, ...patch }));
    });
  }
}
