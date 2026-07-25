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
import { theme } from "./render/theme";
import { restoreTerminalBackground, setTerminalBackground } from "./terminal-surface";
import { discoverDoctorChecks } from "./doctor/discover";
import { runDoctor } from "./doctor/run";
import { activeBackendId } from "./keystore/keystore";
import { readVault } from "./providers/vault";
import { APP_VERSION } from "../version";
import { watchStudio, type StudioWatchSource } from "./watch/watcher";

async function main(): Promise<void> {
  const bridge = createBridge();
  const decks = await bridge.deckCounts();
  const pieces = await bridge.list();
  const total = decks.reduce((sum, deck) => sum + deck.count, 0);
  const studioName = basename(bridge.studioDir) || "Hoplight Studio";
  const session = await createSession(bridge);
  const commands = await discoverCommands();
  const doctorChecks = await discoverDoctorChecks();
  const diagnose = (): ReturnType<typeof runDoctor> =>
    runDoctor(doctorChecks, {
      pieces: () => bridge.list(),
      provider: (signal) => session.providerProbe?.(signal) ?? Promise.resolve(null),
      async vault() {
        const [vault, backend] = await Promise.all([readVault(), activeBackendId()]);
        return {
          backend,
          providers: vault.providers.length,
          active: vault.activeId !== null,
        };
      },
      version: APP_VERSION,
      runtime: Bun.version,
    });
  const studioWatcher: StudioWatchSource = (onChange) =>
    watchStudio({
      initial: pieces,
      list: () => bridge.list(),
      onChange,
    });

  setTerminalBackground(process.stdout, theme.well);
  try {
    const renderer = await createCliRenderer({
      screenMode: "alternate-screen",
      exitOnCtrlC: true,
      useMouse: true,
      backgroundColor: theme.well,
    });
    const root = createRoot(renderer);
    const quit = (): void => {
      root.unmount();
      renderer.destroy();
      restoreTerminalBackground(process.stdout);
      process.exit(0);
    };

    root.render(
      <App
        studioName={studioName}
        totalPieces={total}
        decks={decks}
        pieces={pieces}
        session={session}
        commands={commands}
        runDoctor={diagnose}
        watchStudio={studioWatcher}
        onQuit={quit}
      />,
    );

    if (process.env.KIT_SMOKE) {
      console.error(`kit-smoke: mounted; studio=${studioName} pieces=${total}`);
      setTimeout(quit, 500);
    }
  } catch (error) {
    restoreTerminalBackground(process.stdout);
    throw error;
  }
}

void main().catch((error) => {
  console.error("kit: failed to start", error);
  process.exit(1);
});
