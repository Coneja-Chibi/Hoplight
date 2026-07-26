/** @jsxImportSource @opentui/react */
/**
 * App-to-gate integration: confirmed writes visibly pause and resume only after a user choice.
 */
import { expect, test } from "bun:test";
import { settleRender as tick, testRender } from "./test-render";
import type { Session } from "../session";
import { App } from "./app";

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
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
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
    await tick(60);
    await rendered.mockInput.typeText("apply it");
    rendered.mockInput.pressEnter();
    await tick(60);
    expect(rendered.captureCharFrame()).toContain("REVIEW CHANGE");
    expect(rendered.captureCharFrame()).toContain("character / aphrodite");
    expect(rendered.captureCharFrame()).toContain("name");
    expect(rendered.captureCharFrame()).toContain("Aphrodite");
    expect(rendered.captureCharFrame()).toContain("Dite");
    expect(rendered.captureCharFrame()).toContain("Apply & save");
    expect(rendered.captureCharFrame()).toContain("Discard");
    expect(choice).toBe("");
    rendered.mockInput.pressKey("y");
    await tick(60);
    expect(choice).toBe("allow-once");
    expect(rendered.captureCharFrame()).not.toContain("GATE");
  } finally {
    await rendered.renderer.destroy();
  }
});
