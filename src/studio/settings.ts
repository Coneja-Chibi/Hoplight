/**
 * Settings store - atomic write; missing file = defaults; corrupt/unreadable throws.
 */
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { writeAtomicReplace } from "./atomic-file";
import { StudioReadError } from "./errors";
import { parseSettings, type StudioSettings, DEFAULT_SETTINGS } from "./settings-shape";

export class SettingsStore {
  private writeTail: Promise<void> = Promise.resolve();

  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, "settings.json");
  }

  async read(): Promise<StudioSettings> {
    try {
      await access(this.file, constants.F_OK);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return { ...DEFAULT_SETTINGS };
      throw new StudioReadError();
    }
    let text: string;
    try {
      text = await Bun.file(this.file).text();
    } catch {
      throw new StudioReadError();
    }
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
    await mkdir(this.dir, { recursive: true });
    await writeAtomicReplace(this.file, JSON.stringify(settings, null, 2));
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
