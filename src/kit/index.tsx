#!/usr/bin/env bun
/** @jsxImportSource @opentui/react */
/**
 * Kit's entry: bind to the studio, bring up the alt-screen renderer, mount the chrome.
 * Typing `kit` in a terminal lands here. This is the imperative shell; pure logic stays in the
 * engine and (next) the loop and tools. The `import "@opentui/react/runtime-plugin-support"` line
 * is what lets the same code run both under `bun run` and as an installed binary.
 */
import "@opentui/react/runtime-plugin-support";
import { basename } from "node:path";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createBridge } from "./bridge";
import { createSession } from "./session";
import { discoverCommands } from "./commands/discover";
import { App } from "./render/app";

async function main(): Promise<void> {
  const bridge = createBridge();
  const decks = await bridge.deckCounts();
  const total = decks.reduce((sum, deck) => sum + deck.count, 0);
  const studioName = basename(bridge.studioDir) || "Hoplight Studio";
  const session = await createSession(bridge);
  const commands = await discoverCommands();

  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: true,
    useMouse: true,
  });
  const root = createRoot(renderer);
  const quit = (): void => {
    root.unmount();
    process.exit(0);
  };

  root.render(
    <App studioName={studioName} totalPieces={total} decks={decks} session={session} commands={commands} onQuit={quit} />,
  );

  if (process.env.KIT_SMOKE) {
    console.error(`kit-smoke: mounted; studio=${studioName} pieces=${total}`);
    setTimeout(quit, 500);
  }
}

void main().catch((error) => {
  console.error("kit: failed to start", error);
  process.exit(1);
});
