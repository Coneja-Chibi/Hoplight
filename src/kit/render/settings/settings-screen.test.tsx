/** @jsxImportSource @opentui/react */
/**
 * Settings render: prove the real state-to-pixels wiring, not just that it mounts. Against an empty
 * throwaway HOPLIGHT_HOME, the screen must load the spokes and vault and draw the Panel Deck, the
 * sections rail, and the "add a provider" row. The navigation logic itself is covered in model.test.
 */
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { settleRender as tick, testRender } from "../test-render";
import { SettingsScreen } from "./settings-screen";
import { loadChoices } from "./providers-data";
import type { SettingsVaultApi } from "./settings-screen";
import type { ProviderConfig } from "../../providers/config";

const HOME = join(tmpdir(), `kit-settings-test-${randomUUID()}`);

// Renderer drives can take several seconds under the full suite.
setDefaultTimeout(30000);

beforeAll(async () => {
  process.env.HOPLIGHT_HOME = HOME;
  await loadChoices(); // warm the spoke registry so the component's async load resolves fast
});

afterAll(async () => {
  delete process.env.HOPLIGHT_HOME;
  await rm(HOME, { recursive: true, force: true });
});

test("renders the Panel Deck with the providers section and the add row", async () => {
  const t = await testRender(
    <SettingsScreen studioName="Studio" onClose={() => {}} onSaved={() => {}} />,
    { width: 100, height: 30 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("add a provider"), { maxPasses: 300 });
    const frame = t.captureCharFrame();
    expect(frame).toContain("settings");
    expect(frame).toContain("SECTIONS");
    expect(frame).toContain("Providers");
    expect(frame).toContain("add a provider");
  } finally {
    await t.renderer.destroy();
  }
});

// React commits on a real macrotask the harness's pass-pumping does not reliably yield; a short
// real-timer tick after each press makes the drive deterministic (a live renderer has real timers).
test("provider setup masks the key, lists models, selects one, and saves", async () => {
  const saved: unknown[] = [];
  const vaultApi: SettingsVaultApi = {
    read: async () => ({ providers: [], activeId: null }),
    save: async (config) => ({ ...config, id: "saved" }),
    activate: async () => {},
    remove: async () => {},
  };
  const stubModels = async (): Promise<{ id: string; context?: number }[]> => [
    { id: "deepseek-chat", context: 128000 },
    { id: "deepseek-reasoner", context: 64000 },
  ];
  const t = await testRender(
    <SettingsScreen
      studioName="Studio"
      onClose={() => {}}
      onSaved={(config) => saved.push(config)}
      listModels={stubModels}
      modelsDebounceMs={10}
      vaultApi={vaultApi}
    />,
    { width: 100, height: 34 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("add a provider"), { maxPasses: 300 });
    t.mockInput.pressKey("2"); // focus the content pane (the add row)
    t.mockInput.pressEnter(); // open the picker
    await tick();
    await t.waitForFrame((frame) => frame.includes("Choose a provider"), { maxPasses: 100 });
    t.mockInput.pressKey("ARROW_DOWN"); // move through the list, then pick
    t.mockInput.pressEnter();
    await tick();
    await t.waitForFrame((frame) => frame.includes("paste your key"), { maxPasses: 100 });
    await t.mockInput.typeText("sk-live-secret");
    await tick();
    const masked = await t.waitForFrame((f) => f.includes("●"), { maxPasses: 100 });
    expect(masked).not.toContain("sk-live-secret"); // the key is masked, never shown

    await tick(40); // let the debounced (10ms) model fetch fire and land
    t.mockInput.pressKey("TAB"); // move focus to the model field: the live list appears
    await tick();
    const listFrame = await t.waitForFrame((f) => f.includes("2 of 2 models"), { maxPasses: 200 });
    expect(listFrame).toContain("deepseek-chat");
    expect(listFrame).toContain("128K");

    t.mockInput.pressKey("ARROW_DOWN"); // highlight moves off the default onto deepseek-reasoner
    t.mockInput.pressEnter();
    for (let i = 0; i < 200 && saved.length === 0; i++) await tick(50);
    expect(saved.length).toBe(1);
    expect((saved[0] as { model: string }).model).toBe("deepseek-reasoner");
  } finally {
    await t.renderer.destroy();
  }
});

test("activating an existing provider notifies App and rejected mutations stay visible", async () => {
  const providers: ProviderConfig[] = [
    { id: "one", kind: "openai", model: "first", name: "First" },
    { id: "two", kind: "openai", model: "second", name: "Second" },
  ];
  let activeId = "one";
  let changes = 0;
  const vaultApi: SettingsVaultApi = {
    async read() {
      return { providers, activeId };
    },
    async save(config) {
      return config;
    },
    async activate(id) {
      activeId = id;
    },
    async remove() {},
  };
  const t = await testRender(
    <SettingsScreen
      studioName="Studio"
      onClose={() => {}}
      onSaved={() => {}}
      onChanged={() => {
        changes += 1;
      }}
      vaultApi={vaultApi}
    />,
    { width: 100, height: 30 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("Second"), { maxPasses: 300 });
    t.mockInput.pressKey("ARROW_DOWN");
    t.mockInput.pressKey("d");
    await t.waitFor(() => activeId === "two");
    expect(activeId).toBe("two");
    expect(changes).toBe(1);

    vaultApi.activate = async () => {
      throw new Error("provider switch failed");
    };
    t.mockInput.pressKey("d");
    const failedFrame = await t.waitForFrame(
      (frame) => frame.includes("provider switch failed"),
      { maxPasses: 300 },
    );
    expect(failedFrame).toContain("provider switch failed");
  } finally {
    await t.renderer.destroy();
  }
});
