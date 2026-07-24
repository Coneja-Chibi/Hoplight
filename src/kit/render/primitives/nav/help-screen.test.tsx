/** @jsxImportSource @opentui/react */
/**
 * Help stage render: prove the state-to-pixels wiring, not just that it mounts. Against a stub command
 * list plus the real keybinding catalog, the stage must draw the grouped section headings, the command
 * rows, and the keybinding rows beside them; esc must close it.
 */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { HelpScreen } from "./help-screen";
import type { HelpCommand } from "./help-model";

const commands: HelpCommand[] = [
  { name: "/model", summary: "connect or switch your studio brain", group: "setup", aliases: ["/providers"] },
  { name: "/help", summary: "this stage", group: "moving", aliases: ["/?"] },
  { name: "/quit", summary: "leave Kit", group: "session" },
];

const tick = (ms = 15): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test("draws the grouped sections, command rows, and keybinding rows", async () => {
  const t = await testRender(<HelpScreen commands={commands} onClose={() => {}} />, { width: 80, height: 30 });
  try {
    await t.waitForFrame((frame) => frame.includes("MOVING AROUND"), { maxPasses: 200 });
    const frame = t.captureCharFrame();
    expect(frame).toContain("help");
    expect(frame).toContain("SETUP");
    expect(frame).toContain("/model");
    expect(frame).toContain("/providers"); // aliases render in the keys column
    expect(frame).toContain("ctrl+f"); // a keybinding row beside the commands
    expect(frame).toContain("SESSION");
    expect(frame).toContain("/quit");
  } finally {
    await t.renderer.destroy();
  }
});

test("esc closes the stage", async () => {
  let closed = false;
  const t = await testRender(
    <HelpScreen commands={commands} onClose={() => { closed = true; }} />,
    { width: 80, height: 30 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("SETUP"), { maxPasses: 200 });
    t.mockInput.pressEscape();
    for (let i = 0; i < 50 && !closed; i++) await tick();
    expect(closed).toBe(true);
  } finally {
    await t.renderer.destroy();
  }
});
