/** @jsxImportSource @opentui/react */
/** Proves Kit's top-level shell follows the renderer's live terminal canvas. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { App } from "./app";
import type { Session } from "../session";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60));

test("the shell follows the renderer canvas after a live resize", async () => {
  const session: Session = {
    async runTurn(_input, history) {
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
    />,
    { width: 80, height: 24 },
  );
  try {
    rendered.resize(111, 37);
    await tick();
    const shell = rendered.renderer.root.findDescendantById("kit-root") as {
      width: number;
      height: number;
    };
    expect(shell.width).toBe(111);
    expect(shell.height).toBe(37);
  } finally {
    await rendered.renderer.destroy();
  }
});
