/**
 * The window's CommandContext: every shell action a Kit command may take, RECORDED rather than done.
 *
 * This is the browser half of the command layer, and it lives on the server because that is where
 * the things a command asks about are. `ctx.decks` is a real deck count off the real bridge;
 * `ctx.folders` is the real GrantBook the next turn will read; `ctx.gates.set` really writes the
 * file the terminal reads. What is different from Kit's terminal context is only the OUTPUT side:
 * instead of pushing a line into a renderer, each action appends an effect, and the page draws it.
 *
 * ONE SESSION, THE TURN'S. Everything here comes from `studioSession`, the same handle a turn runs
 * on. A second session would carry a second GrantBook, and `/share` would then report success while
 * granting the model nothing - the failure being quiet is what makes it worth naming.
 *
 * A COMMAND THAT THROWS BECOMES A LINE. Kit's run-command.ts holds that rule for the terminal
 * because commands are drop-in files, and one of them failing must cost that command rather than
 * the session. The same applies here, one process further out.
 */
import { matchCommand, type CommandContext, type KitCommand } from "../../kit/commands/command";
import type { SessionCommandContext } from "../../kit/sessions/session-actions";
import { buildContextPreview } from "../../kit/context/shell";
import { formatLedger } from "../../kit/providers/egress-ledger";
import { readGateMode, writeGateMode } from "../../kit/tools/safety/gate-store";
import type { PermissionMode } from "../../kit/tools/safety/gate-core";
import { discoverDoctorChecks } from "../../kit/doctor/discover";
import { runDoctor } from "../../kit/doctor/run";
import { readVault } from "../../kit/providers/vault";
import { activeBackendId } from "../../kit/keystore/keystore";
import { APP_VERSION } from "../../version";
import type { ModelMessage } from "../../kit/providers/provider";
import { studioBridge, studioSession, WINDOW_SURFACE } from "./turn-stream";
import { findPreset } from "../../kit/tools/_shared/find-preset";
import { readEgress } from "./agent-ledger";
import { windowSessions } from "./command-sessions";
import { MAX_SHELF_BYTES, imageDataUrl } from "./image-data";
import type { CommandEffect, WidgetImage, WidgetRow } from "./command-core";

/** Bounded: a shelf is a picture per piece, and a page holding forty of them is not a page. */
const GALLERY_LIMIT = 12;

/** What the window posts alongside the command line. */
export interface CommandTurn {
  readonly line: string;
  readonly messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[];
  readonly studioDir: string;
  readonly signal?: AbortSignal;
}

/** Kit's help sections, in Kit's order, so `/help` here reads like `/help` there. */
const GROUP_ORDER = ["setup", "session", "moving"];

const helpRows = (commands: readonly KitCommand[]): WidgetRow[] => {
  const groupOf = (command: KitCommand): string => command.group ?? "other";
  const rank = (group: string): number => {
    const at = GROUP_ORDER.indexOf(group);
    return at === -1 ? GROUP_ORDER.length : at;
  };
  return [...commands]
    .sort((a, b) => rank(groupOf(a)) - rank(groupOf(b)) || a.name.localeCompare(b.name))
    .map((command) => ({
      label: command.name,
      note: command.summary,
      // Every row is typable, so reading the list and using it are the same gesture.
      send: command.name,
    }));
};

/**
 * The doctor's rows, from Kit's own checks against Kit's own runner.
 *
 * Assembled the way kit/index.tsx assembles it, because the diagnostic is only worth anything if it
 * diagnoses the same things: the same vault, the same studio, the same provider ping.
 */
async function doctorRows(studioDir: string): Promise<CommandEffect> {
  const bridge = studioBridge(studioDir);
  const session = await studioSession(studioDir);
  const checks = await discoverDoctorChecks();
  const results = await runDoctor(checks, {
    pieces: () => bridge.list(),
    provider: (sig) => session.providerProbe?.(sig) ?? Promise.resolve(null),
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
    // Bun rather than a browser: this is what the checks are actually running on, and reporting the
    // page's user agent here would be a diagnostic about the wrong process.
    runtime: Bun.version,
  });
  return {
    kind: "doctor",
    rows: results.map((row) => ({ label: row.label, status: row.status, detail: row.detail })),
  };
}

/**
 * Build the context, the effect list it writes into, and the settle step.
 *
 * SETTLE EXISTS BECAUSE SOME ACTIONS ARE DECLARED SYNCHRONOUS AND THEIR CONSEQUENCES ARE NOT, and
 * both cases here were caught by running the real window rather than by any type:
 *
 *  - `gates.set` returns nothing, and `/gates` immediately says the choice is remembered for next
 *    time. The write that makes that true is a file operation, so a failed write has to be able to
 *    correct the sentence rather than leave a promise on screen that nothing kept.
 *  - `openPlaybill` is declared void and is called without an await. In the terminal it flips a view
 *    flag; here it reads a directory, so `/session` returned an empty effect list while the read was
 *    still in flight and printed nothing at all.
 *
 * Anything deferred is awaited before the effects are read, and the effect array is the same object
 * throughout, so work that finishes during settle is still reported.
 */
async function buildContext(
  turn: CommandTurn,
  commands: readonly KitCommand[],
  arg: string,
): Promise<{ ctx: SessionCommandContext; effects: CommandEffect[]; settle: () => Promise<void> }> {
  const effects: CommandEffect[] = [];
  const record = (effect: CommandEffect): void => { effects.push(effect); };
  const say = (text: string): void => { record({ kind: "say", text }); };
  /** Work a void-returning action started, which the caller must wait on before reporting. */
  const deferred: Promise<unknown>[] = [];

  const bridge = studioBridge(turn.studioDir);
  const session = await studioSession(turn.studioDir);
  /**
   * Read together, and read BEFORE the command runs. Two of the three are exposed to commands as
   * synchronous getters (`ctx.decks`, `ctx.gates.mode()`), which is Kit's shape and not something to
   * change from this side; the provider comes along because /context wants its window size and
   * asking for it mid-command would be the same problem one call later.
   */
  const [decks, gateMode, provider] = await Promise.all([
    bridge.deckCounts(),
    readGateMode(),
    session.activeProvider(),
  ]);
  let pendingMode: PermissionMode | null = null;

  const history: ModelMessage[] = turn.messages.map((m) => ({ role: m.role, content: m.content }));

  const showPictures = (title: string, images: readonly WidgetImage[]): void => {
    if (images.length === 0) {
      say("That picture could not be shown here. It is either empty or a format this window cannot draw.");
      return;
    }
    record({ kind: "images", title, images });
  };

  const ctx: SessionCommandContext = {
    arg,
    commands,
    decks,
    unlisted: () => session.unlisted?.() ?? Promise.resolve([]),
    openSettings: () => { record({ kind: "settings" }); },
    /**
     * KIT OPENS A STAGE; THE WINDOW HAS NO STAGES. The honest translation of "open the reference" in
     * a panel this size is to put the reference in the transcript, built from the same registry the
     * terminal's help stage reads, so neither can drift from what is wired.
     */
    openHelp: () => {
      record({
        kind: "rows",
        title: "Commands",
        rows: helpRows(commands),
        hint: "Type one, or choose it. Start a message with // to send a line that begins with a slash.",
      });
    },
    openTools: () => {
      const capabilities = session.capabilities?.() ?? [];
      if (capabilities.length === 0) {
        say("This build exposes no content capabilities.");
        return;
      }
      record({
        kind: "rows",
        title: `What Kit can do to a piece · ${String(capabilities.length)}`,
        rows: capabilities.map((capability) => ({
          label: capability.id,
          note: `${capability.effect === "read" ? "reads" : "drafts"} · ${capability.summary}`,
        })),
        hint: "These are the operations the model reaches through its tools. Every write still meets the Gate.",
      });
    },
    quit: () => { record({ kind: "close" }); },
    probe: async () => {
      const probe = await session.providerProbe?.(turn.signal);
      if (!probe) {
        say("No provider is connected, so there is nothing to ping. Add one with /model.");
        return;
      }
      say(`**${probe.name}** · ${probe.model} answered in ${String(Math.round(probe.ms))}ms.\n\n${probe.text.slice(0, 400)}`);
    },
    doctor: async () => {
      record(await doctorRows(turn.studioDir));
    },
    say,
    showImage: (bytes, note, source) => {
      const src = imageDataUrl(bytes);
      showPictures(source ?? "Image", src === null ? [] : [{ src, caption: note }]);
    },
    art: {
      async show(query) {
        if (!session.art) return { ok: false as const, detail: "This studio has no art seam." };
        const found = await session.art.find(query);
        if ("detail" in found) return { ok: false as const, detail: found.detail };
        const src = imageDataUrl(found.bytes, found.mime);
        if (src === null) {
          return { ok: false as const, detail: `${found.name}'s art is too large or not a format this window can draw.` };
        }
        showPictures(found.name, [{ src, caption: found.name }]);
        return { ok: true as const };
      },
    },
    gallery: {
      async open(kind) {
        if (!session.art) return { ok: false as const, detail: "This studio has no art seam." };
        const deck = kind ?? "character";
        const shelf = await session.art.gallery(deck, GALLERY_LIMIT);
        const images: WidgetImage[] = [];
        let carried = 0;
        let stopped = false;
        for (const piece of shelf.found) {
          // The budget is checked on the RAW bytes, before encoding: base64 inflates by a third, and
          // a limit measured after the inflation would be a limit on a number nobody can picture.
          if (carried + piece.bytes.byteLength > MAX_SHELF_BYTES) { stopped = true; break; }
          const src = imageDataUrl(piece.bytes, piece.mime);
          if (src === null) continue;
          carried += piece.bytes.byteLength;
          images.push({ src, caption: piece.name });
        }
        // Silent on an empty shelf: /gallery says that itself, in its own words.
        if (images.length > 0) {
          record({
            kind: "images",
            // The truncation is said rather than hidden, the same rule /decks follows about what it
            // is not showing you.
            title: shelf.more || stopped
              ? `${deck} art · first ${String(images.length)} of more`
              : `${deck} art · ${String(images.length)}`,
            images,
          });
        }
        return { ok: true as const, count: images.length };
      },
      // Nothing to close: these are transcript bands, not a strip pinned to an edge. No command
      // calls this, and a message about closing something that was never open would be noise.
      close: () => {},
    },
    /**
     * `/rail` HERE MEANS THE WORKBENCH.
     *
     * This app has no column pinned beside the chat, and for a while that meant the command was
     * withheld - which left the one thing it does with no way to ask for it. But the window already
     * owns a surface that shows a preset's blocks in order and lets you drag them, and it is the
     * Workbench. So the command is offered and lands there, and `close` is honest about there being
     * nothing to close: a bench tab is yours to keep until you close it yourself.
     *
     * The SAME matcher the tool uses, so "/rail paramnesia" and the model's rail_open can never
     * disagree about which preset that word meant.
     */
    rail: {
      open: async (query: string) => {
        const picked = findPreset(await bridge.list("preset"), query);
        if (!picked.ok) return { ok: false as const, detail: picked.detail };
        record({ kind: "open", piece: { kind: "preset", id: picked.piece.id } });
        record({
          kind: "say",
          text: `${picked.piece.name || picked.piece.id} is now open on ${WINDOW_SURFACE}.`,
        });
        return { ok: true as const };
      },
      // A Workbench tab is not a strip pinned to an edge: it closes when the person closes it, and
      // a command that shut their editor from the chat would be taking something away.
      close: () => {},
    },
    gates: {
      mode: () => pendingMode ?? gateMode,
      set: (mode) => { pendingMode = mode; },
    },
    egressSummary: () => formatLedger(readEgress()),
    contextPreview: () => buildContextPreview(session, history, provider),
    ...(session.folders ? { folders: session.folders } : {}),
    pieces: async (kind: string) =>
      (await bridge.list(kind)).map((piece) => ({ id: piece.id, ...(piece.name ? { name: piece.name } : {}) })),
    sessions: windowSessions(turn.messages, record, (work) => { deferred.push(work); }),
  };

  const settle = async (): Promise<void> => {
    // Settled rather than awaited in a chain: one deferred read failing must not take the effects
    // every other action already recorded down with it.
    await Promise.allSettled(deferred);
    if (pendingMode === null) return;
    const stuck = await writeGateMode(pendingMode);
    if (!stuck) {
      say("That setting could not be saved, so it will be back to asking about everything next launch.");
    }
  };

  return { ctx, effects, settle };
}

/** Run one matched command and report what it did. Never throws: a failure is a line. */
export async function runKitCommand(
  turn: CommandTurn,
  commands: readonly KitCommand[],
): Promise<{ ok: true; effects: CommandEffect[] } | { ok: false; why: string }> {
  const matched = matchCommand(commands, turn.line);
  // The page matched before posting, so reaching here means the two disagree - a page left open
  // across an update, most likely. Refused rather than guessed at.
  if (!matched) return { ok: false, why: "not a command this build knows" };

  const { ctx, effects, settle } = await buildContext(turn, commands, matched.arg);
  try {
    await matched.command.run(ctx as CommandContext);
  } catch (error) {
    effects.push({ kind: "say", text: error instanceof Error ? error.message : String(error) });
  }
  await settle();
  return { ok: true, effects };
}
