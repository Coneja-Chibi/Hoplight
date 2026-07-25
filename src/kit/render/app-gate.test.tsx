/** @jsxImportSource @opentui/react */
/**
 * App-to-gate integration: confirmed writes visibly pause and resume only after a user choice.
 */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { Session } from "../session";
import { App } from "./app";

const tick = (ms = 60): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test("a confirmed write pauses in GatePrompt before the session continues", async () => {
  let choice = "";
  const session: Session = {
    async runTurn(_input, history, _onEvent, _signal, gate) {
      const picked = await gate!.requestConfirm!({
        name: "change_apply",
        verdict: {
          access: "write",
          level: "caution",
          reason: "creates or updates a piece",
        },
        peek: {
          title: "change_apply draft-1",
          detail: "draftId: draft-1",
          level: "caution",
          reason: "creates or updates a piece",
        },
      });
      choice = picked.type;
      gate!.onChoice?.(picked, "change_apply");
      return history;
    },
    async probe() {},
    async activeProvider() {
      return null;
    },
  };
  const rendered = await testRender(
    <App
      studioName="Studio"
      totalPieces={0}
      decks={[]}
      session={session}
      commands={[]}
      onQuit={() => {}}
      now={() => 1000}
    />,
    { width: 80, height: 24 },
  );
  try {
    await tick();
    await rendered.mockInput.typeText("apply it");
    rendered.mockInput.pressEnter();
    await tick();
    expect(rendered.captureCharFrame()).toContain("GATE");
    expect(rendered.captureCharFrame()).toContain("change_apply draft-1");
    expect(choice).toBe("");
    rendered.mockInput.pressKey("y");
    await tick();
    expect(choice).toBe("allow-once");
    expect(rendered.captureCharFrame()).not.toContain("GATE");
  } finally {
    await rendered.renderer.destroy();
  }
});
