/** @jsxImportSource @opentui/react */
/** Verifies the composer and provider state render as one fused, terminal-native prompter rail. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { KitCommand } from "../../../commands/command";
import { Composer } from "./composer";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60));

test("composer fuses input and provider state under one open heavy rule", async () => {
  const t = await testRender(
    <Composer
      active={false}
      provider={{ name: "NanoGPT", model: "zai-org/glm-5.2:thinking" }}
      busy={false}
      commands={[]}
      onSubmit={() => true}
    />,
    { width: 72, height: 8 },
  );
  try {
    await tick();
    const frame = t.captureCharFrame();
    const rows = frame.split("\n");
    const promptRow = rows.findIndex((row) => row.includes("talk to your studio"));
    const statusRow = rows.findIndex((row) => row.includes("NanoGPT"));

    expect(frame).toContain("zai-org/glm-5.2:thinking");
    expect(frame).toContain("ready");
    expect(frame).toContain("━");
    expect(promptRow).toBeGreaterThanOrEqual(0);
    expect(statusRow).toBe(promptRow + 2);
    expect(frame).not.toMatch(/[┗┛┃]/);
  } finally {
    await t.renderer.destroy();
  }
});

test("typing slash opens every command and enter runs the filtered selection", async () => {
  const submitted: string[] = [];
  const commands: KitCommand[] = [
    { name: "/test", summary: "check the provider", run: () => {} },
    { name: "/model", aliases: ["/providers"], summary: "connect a provider", run: () => {} },
    { name: "/privacy", summary: "show what left this machine", run: () => {} },
  ];
  const t = await testRender(
    <Composer
      active={false}
      provider={null}
      busy={false}
      commands={commands}
      onSubmit={(value) => {
        submitted.push(value);
        return true;
      }}
    />,
    { width: 72, height: 18 },
  );
  try {
    await tick();
    await t.mockInput.typeText("/");
    await tick();
    const openFrame = t.captureCharFrame();
    expect(openFrame).toContain("SLASH COMMANDS");
    expect(openFrame).toContain("/model");
    expect(openFrame).toContain("/privacy");
    expect(openFrame).toContain("/test");

    await t.mockInput.typeText("mod");
    await tick();
    expect(t.captureCharFrame()).not.toContain("/privacy");
    t.mockInput.pressEnter();
    await tick();
    expect(submitted).toEqual(["/model"]);
    expect(t.captureCharFrame()).not.toContain("SLASH COMMANDS");
  } finally {
    await t.renderer.destroy();
  }
});
