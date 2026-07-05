/**
 * The settings store - the imperative shell around settings-shape. One plain json file in the
 * studio folder (<studioDir>/settings.json), same local-first doctrine as the entity store:
 * inspectable, portable, no hidden state. Reads are tolerant (missing/corrupt = defaults);
 * writes replace the whole document (the wizard/settings surface always sends the full shape).
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseSettings, type StudioSettings } from "./settings-shape";

export class SettingsStore {
  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, "settings.json");
  }

  async read(): Promise<StudioSettings> {
    try {
      return parseSettings(JSON.parse(await Bun.file(this.file).text()));
    } catch {
      return parseSettings(null); // absent or corrupt reads as fresh defaults, never throws
    }
  }

  async save(raw: unknown): Promise<StudioSettings> {
    const settings = parseSettings(raw);
    await mkdir(this.dir, { recursive: true });
    await Bun.write(this.file, JSON.stringify(settings, null, 2));
    return settings;
  }
}
