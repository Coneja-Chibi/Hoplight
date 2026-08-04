/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the session state and composes the
 * render/primitives widgets. Typing runs a turn through the session; its events (say / tool / stopped
 * / error) stream in as the matching widget. No chrome is drawn inline; the look lives in primitives/.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRenderer } from "@opentui/react";
import type { DeckCount, EntitySummary } from "../bridge";
import type { ModelMessage } from "../providers/provider";
import type { Session as ChatSession } from "../session";
import { matchCommand, nearestCommand, type KitCommand } from "../commands/command";
import { theme } from "./theme";
import { OpeningBanner } from "./primitives/opening-banner";
import { Playbill } from "./primitives/playbill";
import { Scrollback } from "./primitives/scrollback";
import { SayLine } from "./primitives/say-line";
import { Composer } from "./primitives/composer/composer";
import { QueueTicket } from "./primitives/composer/queue-ticket";
import { useQueuedWhispers } from "./primitives/composer/use-queued-whispers";
import { StatusRow } from "./primitives/status-row";
import { StatusToast } from "./primitives/status-toast";
import { ThoughtBox } from "./primitives/thought-box";
import { BackstageBox } from "./primitives/backstage-box";
import { SettledLine } from "./primitives/settled-line";
import { SearchCard } from "./primitives/nav/search-card";
import { SnapPill } from "./primitives/nav/snap-pill";
import { useScrollSeam } from "./primitives/nav/use-scroll-seam";
import { initNewBelow, trackNewBelow } from "./primitives/nav/scroll-seam";
import { applyTurnEvent, settleTurn, toggleTrace, type RenderLine, type TurnView } from "./turn-events";
import { EMPTY_LEDGER, recordEgress, formatLedger, type EgressLedger } from "../providers/egress-ledger";
import { buildContextPreview } from "../context/shell";
import { useNotify } from "./notify/use-notify";
import { useFocus } from "./notify/focus";
import type { NotifySettings } from "./notify/plan";
import { appendTurn, buildTurn, emptySession, type Session as MemorySession } from "../sessions/session-model";
import { RewindRail } from "../sessions/render/rewind-rail";
import { createSessionStore, newSessionId, type SessionStore } from "../sessions/store";
import type { SessionActions, SessionCommandContext } from "../sessions/session-actions";
import { useCopyNotice } from "./use-copy-notice";
import type { DoctorResult } from "../doctor/check";
import type { RailSnapshot } from "../tools/tool";
import type { StudioWatchSource } from "../watch/watcher";
import { GatePrompt } from "./primitives/safety/gate-prompt";
import { useGateController } from "./safety/use-gate";
import { useRailSession } from "./rail/use-rail-session";
import { RailPane } from "./rail/rail-pane";
import { grantPastedPaths } from "./grant-pasted-paths";
import { buildSessionActions } from "./use-session-actions";
import { useShellKeys } from "./use-shell-keys";
import { useStudioShelf } from "./use-studio-shelf";
import { FullScreen } from "./full-screens";
import { decodePngPixels } from "../../studio/signature-color";

/** Notify defaults: all channels on. Bell/desktop are focus-gated in plan.ts, so they only fire when you
 * looked away; a future /gates command will persist per-channel toggles. */
const NOTIFY_SETTINGS: NotifySettings = { title: true, bell: true, desktop: true };

export interface AppProps {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  pieces?: readonly EntitySummary[];
  session: ChatSession;
  commands: KitCommand[];
  onQuit: () => void;
  sessionStore?: SessionStore;
  makeSessionId?: () => string;
  now?: () => number;
  runDoctor?: () => Promise<DoctorResult[]>;
  watchStudio?: StudioWatchSource;
  /**
   * Hand the entry point a live reader for the rail, so the SESSION can answer "what is on screen"
   * without importing render. Called once on mount; the closure reads current state each time.
   */
  onRail?: (read: () => RailSnapshot | null) => void;
}

/** The window shell: session state plus composed widgets. */
export function App({
  studioName,
  totalPieces,
  decks,
  pieces = [],
  session,
  commands,
  onQuit,
  sessionStore,
  makeSessionId = newSessionId,
  now = Date.now,
  runDoctor = async () => [],
  watchStudio,
  onRail,
}: AppProps): ReactNode {
  const renderer = useRenderer();
  const [busy, setBusy] = useState(false);
  /**
   * Has this conversation already been greeted? True for a resumed session, whose turns are proof
   * that somebody was welcomed the first time round.
   */
  const [greeted, setGreeted] = useState(false);
  /**
   * The option somebody just picked, handed to the composer to insert.
   *
   * A one-shot value rather than a command: the composer consumes it and clears it, so picking the
   * same option twice still works and a re-render never re-inserts it.
   */
  const [pickedOption, setPickedOption] = useState<string | null>(null);
  const gate = useGateController();
  const rail = useRailSession(session, gate, (text) => add({ role: "say", text }));
  const { notice: copyNotice, copy } = useCopyNotice(renderer);
  /**
   * Publish a live reader for the rail so the session can answer "what is on screen".
   *
   * A REF, read at call time. Handing over a value would freeze the answer at mount, which is the
   * same staleness that made Kit name the wrong preset with total confidence.
   */
  const railRef = useRef(rail);
  railRef.current = rail;
  useEffect(() => {
    onRail?.(() => {
      const open = railRef.current;
      if (!open.open || !open.presetId) return null;
      return {
        presetId: open.presetId,
        title: open.title || open.presetId,
        blocks: open.state.rows.length,
        enabled: open.state.rows.filter((row) => row.enabled !== false).length,
        pending: open.pending,
      };
    });
  }, [onRail]);
  const [provider, setProvider] = useState<{ name: string; model: string; context?: number } | null>(null);
  const [ledger, setLedger] = useState<EgressLedger>(EMPTY_LEDGER);
  useEffect(() => {
    session.activeProvider().then(setProvider);
  }, [session]);
  const [turn, setTurn] = useState<TurnView>({
    lines: [],
    live: { phase: "idle" },
    label: "",
    tools: null,
    toolsSeen: false,
  });
  /**
   * The options from the most recent choice list, so a number key can pick one.
   *
   * Only the LAST list is live, and only until the person speaks again. An older question further up
   * the transcript has been answered or abandoned, and letting "2" reach back into it would make the
   * same keystroke mean different things depending on how far somebody had scrolled.
   */
  const latestChoices = ((): readonly string[] | undefined => {
    for (let i = turn.lines.length - 1; i >= 0; i--) {
      const line = turn.lines[i];
      if (line?.role === "choices") return line.options.map((o) => o.value);
      if (line?.role === "you") return undefined;
    }
    return undefined;
  })();
  const [startedAt, setStartedAt] = useState(0);
  const [view, setView] = useState<"session" | "settings" | "sessions" | "help" | "tools">(
    process.env.KIT_SMOKE_VIEW === "settings" ? "settings" : "session",
  );
  const [searching, setSearching] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  const scroll = useScrollSeam(view === "session" && !searching && !rewinding);
  const visibleLineCount =
    turn.lines.length
    + (turn.tools ? 1 : 0)
    + (turn.live.phase === "idle" ? 0 : 1);
  const [newBelow, setNewBelow] = useState(() => initNewBelow(visibleLineCount));
  useEffect(() => {
    setNewBelow((previous) =>
      trackNewBelow(previous, {
        atBottom: scroll.metrics.atBottom,
        lineCount: visibleLineCount,
      }),
    );
  }, [scroll.metrics.atBottom, visibleLineCount]);
  const history = useRef<ModelMessage[]>([]);
  const activeTurn = useRef<{ controller: AbortController } | null>(null);
  const queued = useQueuedWhispers();
  const store = useRef<SessionStore | null>(null);
  if (!store.current) store.current = sessionStore ?? createSessionStore();
  const memory = useRef<MemorySession | null>(null);
  if (!memory.current) memory.current = emptySession(makeSessionId(), now());
  // Notify: title/bell/desktop fire on the turn's busy falling edge, focus-gated (see notify/plan.ts).
  const focused = useFocus();
  const add = (line: RenderLine): void =>
    setTurn((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  const shelf = useStudioShelf({
    pieces,
    decks,
    totalPieces,
    watchStudio,
    folders: session.folders,
    onChangeNotice: (text) => add({ role: "watch", text }),
  });
  useNotify({ busy, focused, studio: studioName, settings: NOTIFY_SETTINGS, notice: shelf.notices });

  const { actions: sessionActions } = buildSessionActions({
    store, memory, history, activeTurn, makeSessionId, now, add,
    setTurn, setGreeted, setRewinding, setSearching, setView,
  });

  const startTurn = (
    produce: (
      signal: AbortSignal,
      onEvent: (event: Parameters<typeof applyTurnEvent>[1]) => void,
    ) => Promise<void>,
  ): boolean => {
    if (activeTurn.current) return false;
    const job = { controller: new AbortController() };
    activeTurn.current = job;
    setBusy(true);
    setStartedAt(Date.now());
    setTurn((prev) => ({ ...prev, live: { phase: "waiting" } }));
    const onEvent = (event: Parameters<typeof applyTurnEvent>[1]): void => {
      // Every call's usage is one send: retain it for the on-demand privacy ledger.
      if (event.type === "usage") {
        setLedger((prev) =>
          recordEgress(prev, {
            at: Date.now(),
            provider: provider?.name ?? "provider",
            input: event.usage.input,
            output: event.usage.output,
          }),
        );
      }
      rail.onTurnEvent(event);
      setTurn((prev) => applyTurnEvent(prev, event, Date.now()));
    };
    void (async () => {
      try {
        await produce(job.controller.signal, onEvent);
      } catch (error) {
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
      } finally {
        if (activeTurn.current !== job) return;
        activeTurn.current = null;
        setTurn((prev) => settleTurn(prev, Date.now()));
        setBusy(false);
        const next = queued.shift();
        if (next) runPrompt(next);
      }
    })();
    return true;
  };

  function runPrompt(prompt: string): boolean {
    const accepted = startTurn(async (signal, onEvent) => {
      const before = history.current;
      const nextHistory = await session.runTurn(prompt, before, onEvent, signal, gate.seam());
      history.current = nextHistory;
      const delta = nextHistory.slice(before.length);
      if (delta.length > 0) {
        const nextSession = appendTurn(memory.current!, buildTurn(prompt, delta, now()));
        memory.current = nextSession;
        await store.current!.write(nextSession);
      }
    });
    if (accepted) add({ role: "you", text: prompt });
    return accepted;
  }

  const submit = (raw: string): boolean => {
    const value = raw.trim();
    if (!value) return false;

    // A path somebody wrote is permission for that file; see grant-pasted-paths.ts. The path rides as
    // its own field, not inside the sentence: it is the part somebody acts on, so it gets its own row
    // and becomes clickable rather than something to select out of prose by hand.
    if (session.folders) {
      grantPastedPaths(value, session.folders, ({ path, directory }) =>
        add({
          role: "watch",
          text: directory
            ? "you named this folder, so Kit can look inside it"
            : "you named this file, so Kit can open it",
          path,
        }),
      );
    }
    const matched = matchCommand(commands, value);
    if (matched) {
      const ctx: SessionCommandContext = {
        arg: matched.arg,
        commands,
        decks: shelf.decks,
        openSettings: () => setView("settings"),
        openHelp: () => setView("help"),
        openTools: () => setView("tools"),
        quit: onQuit,
        probe: () => startTurn((signal, onEvent) => session.probe(onEvent, signal)),
        doctor: async () => {
          add({ role: "tool", text: "doctor · running checks" });
          add({ role: "doctor", checks: await runDoctor() });
        },
        say: (text) => add({ role: "say", text }),
        egressSummary: () => formatLedger(ledger),
        contextPreview: () => buildContextPreview(session, history.current, provider),
        folders: session.folders,
        rail: rail.commands,
        sessions: sessionActions,
        pieces: async (kind: string) =>
          shelf.pieces.filter((p) => p.kind === kind).map((p) => ({ id: p.id, name: p.name })),
      };
      try {
        const result = matched.command.run(ctx);
        if (result instanceof Promise) {
          void result.catch((error) =>
            add({ role: "error", text: error instanceof Error ? error.message : String(error) }),
          );
          return true;
        }
        return result !== false;
      } catch (error) {
        add({ role: "error", text: error instanceof Error ? error.message : String(error) });
        return true;
      }
    }
    const escapedSlash = value.startsWith("//");
    if (!escapedSlash && value.startsWith("/")) {
      const typed = value.split(/\s/, 1)[0]!;
      const near = nearestCommand(commands, typed);
      add({
        role: "error",
        text: near
          ? `Unknown command: ${typed}. Did you mean ${near.name}? It ${near.summary}.`
          : `Unknown command: ${typed}. Try /help.`,
      });
      return true;
    }
    const prompt = escapedSlash ? value.slice(1) : value;
    if (activeTurn.current) {
      if (!queued.append(prompt)) {
        add({ role: "error", text: "The follow-up queue is full. Send this after a turn settles." });
        return false;
      }
      return true;
    }
    return runPrompt(prompt);
  };

  useShellKeys({
    active: view === "session" && !searching && !rewinding && !gate.prompt,
    running: activeTurn,
    setTurn,
    openSearch: () => setSearching(true),
    scroll,
  });

  // The screens that REPLACE the conversation get their own component; FullScreen returns null only
  // for "session", which this guard has already excluded.
  if (view !== "session") {
    return (
      <FullScreen
        view={view}
        studioName={studioName}
        commands={commands}
        pieces={shelf.pieces}
        capabilities={session.capabilities?.() ?? []}
        sessionActions={sessionActions}
        busy={busy}
        close={() => setView("session")}
        onProviderChanged={() => { void session.activeProvider().then(setProvider); }}
        onProviderSaved={(name) => {
          setView("session");
          add({ role: "say", text: `Connected ${name}. Talk to your studio.` });
          void session.activeProvider().then(setProvider);
        }}
      />
    );
  }

  return (
    <box id="kit-root" flexDirection="row" backgroundColor={theme.well} width="100%" height="100%">
      {rail.open ? <RailPane rail={rail} /> : null}
      <box flexDirection="column" flexGrow={1} minWidth={0}>
      <Playbill studioName={studioName} />
      {rewinding ? (
        <box flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0} padding={1}>
          <RewindRail actions={sessionActions} busy={busy} onClose={() => setRewinding(false)} />
        </box>
      ) : (
        <>
      {searching ? (
        <box flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0} paddingLeft={1} paddingRight={1} paddingTop={1}>
          <SearchCard lines={turn.lines} onClose={() => setSearching(false)} />
        </box>
      ) : null}
      <box
        visible={!searching}
        flexDirection="column"
        flexGrow={searching ? 0 : 1}
        flexShrink={1}
        flexBasis={searching ? 0 : undefined}
        height={searching ? 0 : undefined}
        minHeight={0}
      >
      <Scrollback scrollRef={scroll.ref}>
        {greeted ? null : (
          <OpeningBanner studioName={studioName} totalPieces={shelf.total} animate={turn.lines.length === 0} />
        )}
        {turn.lines.map((line, index) => (
          <SettledLine
            key={index}
            line={line}
            index={index}
            pieces={shelf.pieces}
            onCopy={copy}
            /**
             * A picked option FILLS the composer; it never sends.
             *
             * Handing the text to the composer rather than submitting it is the whole difference
             * between offering a choice and taking one: the person can still edit it, add to it, or
             * change their mind. A list that submitted on click would let a mis-click say something
             * they never wrote.
             */
            onPick={(value) => setPickedOption(value)}
            onToggle={() => setTurn((prev) => toggleTrace(prev, index))}
          />
        ))}
        {turn.tools ? <BackstageBox moves={turn.tools.moves} phase={turn.tools.phase} /> : null}
        {turn.live.phase === "typing" ? <SayLine text={turn.live.text} streaming /> : null}
        {turn.live.phase === "thinking" ? (
          <ThoughtBox text={turn.live.text} startedAt={startedAt} />
        ) : null}
        {turn.live.phase === "waiting" && !turn.toolsSeen && !turn.tools ? (
          <StatusRow startedAt={startedAt} />
        ) : null}
      </Scrollback>
      <QueueTicket items={queued.items} />
      <SnapPill
        show={newBelow.show}
        unseen={newBelow.unseen}
        onSnap={scroll.snapToBottom}
      />
      <StatusToast text={copyNotice} />
      {gate.prompt ? (
        <GatePrompt
          req={gate.prompt}
          mode={gate.mode}
          onChoice={gate.choose}
        />
      ) : null}
      <Composer
        active={turn.live.phase === "waiting" || turn.live.phase === "thinking" || turn.tools != null}
        enabled={!searching && !gate.prompt}
        provider={provider}
        busy={busy}
        commands={commands}
        decks={shelf.decks}
        pieces={shelf.pieces}
        completeArg={shelf.completeArg}
        insert={pickedOption}
        choiceOptions={latestChoices}
        onInserted={() => setPickedOption(null)}
        onImage={(bytes) => {
          /**
           * Decode to learn the SIZE, and to prove it is really an image before drawing it.
           *
           * `decodePngPixels` fails closed on anything it does not understand, so a clipboard
           * carrying something PNG-shaped but broken becomes a refusal rather than a renderer being
           * handed bytes it cannot use.
           */
          const pixels = decodePngPixels(bytes);
          if (!pixels) {
            add({ role: "watch", text: "that clipboard image could not be read" });
            return;
          }
          add({
            role: "image",
            bytes,
            width: pixels.width,
            height: pixels.height,
            // Says the limit out loud. An image that renders beautifully while the model has no idea
            // it exists is the worst version of this, because it looks like it worked.
            note: "shown to you only - Kit's providers take text, so this is not sent",
          });
        }}
        onSubmit={submit}
      />
      </box>
        </>
      )}
      </box>
    </box>
  );
}
