/** @jsxImportSource @opentui/react */
/**
 * Settings render: prove the real state-to-pixels wiring, not just that it mounts. Against an empty
 * throwaway HOPLIGHT_HOME, the screen must load the spokes and vault and draw the Panel Deck, the
 * sections rail, and the "add a provider" row. The navigation logic itself is covered in model.test.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { testRender } from "@opentui/react/test-utils";
import { SettingsScreen } from "./settings-screen";
import { loadChoices } from "./providers-data";

const HOME = join(tmpdir(), `kit-settings-test-${randomUUID()}`);

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
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 15));

test("real keys drive pick then masked key entry (proves name mapping + masking)", async () => {
  const t = await testRender(
    <SettingsScreen studioName="Studio" onClose={() => {}} onSaved={() => {}} />,
    { width: 100, height: 30 },
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
    const frame = await t.waitForFrame((f) => f.includes("•"), { maxPasses: 100 });
    expect(frame).not.toContain("sk-live-secret"); // the key is masked, never shown
  } finally {
    await t.renderer.destroy();
  }
});
