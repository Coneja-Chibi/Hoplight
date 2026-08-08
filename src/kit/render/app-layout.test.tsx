/** @jsxImportSource @opentui/react */
/** Proves Kit's top-level shell follows the renderer's live terminal canvas. */
import { expect, test } from "bun:test";
import { settleRender as tick, testRender } from "./test-render";
import { App } from "./app";
import type { Session } from "../session";

test("the shell follows the renderer canvas after a live resize", async () => {
  const session: Session = {
    async runTurn(_input, history) {
      return history;
    },
    async probe() {},

    async summarise() { return null; },
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
    await tick(60);
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
