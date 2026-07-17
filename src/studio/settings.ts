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

  async save(raw: unknown): Promise<StudioSettings> {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new StudioReadError("invalid settings payload");
    }
    const settings = parseSettings(raw);
    await mkdir(this.dir, { recursive: true });
    await writeAtomicReplace(this.file, JSON.stringify(settings, null, 2));
    return settings;
  }
}
