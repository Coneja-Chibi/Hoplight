#!/usr/bin/env bun
/** @jsxImportSource @opentui/react */
/**
 * Kit's entry: bind to the studio, bring up the alt-screen renderer, mount the chrome.
 * `bun run kit` from a source checkout lands here. This is the imperative shell; pure logic stays
 * in the engine, loop, and tools. Runtime plugin support also keeps a future compiled Kit entrypoint
 * possible, but current GitHub release artifacts do not ship one.
 */
import "@opentui/react/runtime-plugin-support";
import { basename } from "node:path";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createBridge } from "./bridge";
import { createSession } from "./session";
import type { RailSnapshot } from "./tools/tool";
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
  /**
   * A live handle to the rail, filled in by the shell once it mounts.
   *
   * The session is built before any React state exists, so it cannot be handed the rail directly -
   * and it must not be handed a VALUE either, because the rail changes throughout a conversation.
   * One mutable cell, written by the shell and read per turn, keeps the direction of dependency
   * right: the session never imports render.
   */
  const railCell: { read: () => RailSnapshot | null } = { read: () => null };
  const session = await createSession(bridge, () => railCell.read());
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
          ...(vault.notice ? { notice: vault.notice } : {}),
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
      /**
       * Opt into the Kitty keyboard protocol where the terminal supports it, falling back to the raw
       * parser where it does not. This was absent, and the raw parser is why whole families of keys
       * behaved as if nothing was bound to them:
       *
       * - `disambiguate` fixes ESC timing and ALT+KEY AMBIGUITY. Without it a terminal reports alt+v
       *   as an ESC followed by "v", indistinguishable from someone pressing Escape and then typing,
       *   so no alt chord can be recognised reliably. That is alt+V for image paste, and every other
       *   alt binding.
       * - `alternateKeys` reports the shifted and base-layout key alongside the resolved one, which is
       *   what makes a chord survive a non-US layout instead of silently not matching.
       *
       * Opting in is a request, not a requirement: a terminal that does not answer leaves us exactly
       * where we already were, so this cannot make a working setup worse.
       */
      useKittyKeyboard: { disambiguate: true, alternateKeys: true },
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
        onRail={(read) => { railCell.read = read; }}
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
