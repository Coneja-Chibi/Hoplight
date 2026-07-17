import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "./settings";
import { StudioReadError } from "./errors";

describe("SettingsStore", () => {
  let root: string;
  let store: SettingsStore;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vaude-set-"));
    store = new SettingsStore(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("missing file yields defaults", async () => {
    const s = await store.read();
    expect(s.setupComplete).toBe(false);
  });

  test("corrupt file throws, bytes preserved", async () => {
    const p = join(root, "settings.json");
    await writeFile(p, "NOT JSON{{{");
    await expect(store.read()).rejects.toBeInstanceOf(StudioReadError);
    expect(await Bun.file(p).text()).toBe("NOT JSON{{{");
  });

  test("save + read round trip", async () => {
    await store.save({ setupComplete: true, theme: "stage" });
    const s = await store.read();
    expect(s.setupComplete).toBe(true);
    expect(s.theme).toBe("stage");
  });
});
