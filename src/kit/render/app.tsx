/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the session state and composes the
 * render/primitives widgets. Typing runs a turn through the session; its events (say / tool / stopped
 * / error) stream in as the matching widget. No chrome is drawn inline; the look lives in primitives/.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRenderer, useTerminalDimensions } from "@opentui/react";
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
import { appendTurn, buildTurn, emptySession, withRail, type Session as MemorySession } from "../sessions/session-model";
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
import { BlockEditor } from "./editor/block-editor";
import { useGallery } from "./gallery/use-gallery";
import { GalleryStrip } from "./gallery/gallery-strip";
import { grantPastedPaths } from "./grant-pasted-paths";
import { buildSessionActions } from "./use-session-actions";
import { useShellKeys } from "./use-shell-keys";
import { useStudioShelf } from "./use-studio-shelf";
import { FullScreen } from "./full-screens";
import { imageLine } from "./show-image";
import { usePendingImages } from "./use-pending-images";
import { runCommand } from "./run-command";
import { useRailSnapshot } from "./use-rail-snapshot";
import { useResumeAtLaunch, type ResumeRequest } from "./use-resume-at-launch";
import { useOpenAsk } from "./ask/use-open-ask";

/** A conversation with nothing in it yet. */
const emptyTurn = (): TurnView =>
  ({ lines: [], live: { phase: "idle" }, label: "", tools: null, toolsSeen: false });

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
  /**
   * Pick up a saved session at launch: true for the most recent, a string for one by id. Absent
   * opens blank, which stays the default - see launch-args.ts.
   */
  resume?: ResumeRequest;
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
  resume,
}: AppProps): ReactNode {
  const renderer = useRenderer();
  // The editor card insets itself from the real terminal, so it needs the real size.
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const [busy, setBusy] = useState(false);
  /**
   * Has this conversation already been greeted? True for a resumed session, whose turns are proof
   * that somebody was welcomed the first time round.
   */
  const [greeted, setGreeted] = useState(false);
  // Lets a rewrite corrected at the gate be the thing that actually gets written; see use-gate.ts.
  const gate = useGateController((draftId, blockId, content) =>
    session.presets?.amendBlock(draftId, blockId, content) ?? false);
  const gallery = useGallery(session);
  // Above the rail because the editor card copies through it, and it only needs the renderer.
  const { notice: copyNotice, copy } = useCopyNotice(renderer);
  const rail = useRailSession(session, gate, (t) => add({ role: "say", text: t }), undefined, copy);
  // Read at call time: the hook is built before turn and submit exist, and a captured value would be
  // the one from the render it was built in.
  const turnLines = useRef<readonly RenderLine[]>([]);
  const submitRef = useRef<(message: string) => void>(() => {});
  // Lets the session answer "what is on screen" without importing render; see use-rail-snapshot.ts.
  const railRef = useRailSnapshot(rail, onRail);
  const [provider, setProvider] = useState<{ name: string; model: string; context?: number; images?: boolean } | null>(null);
  const [ledger, setLedger] = useState<EgressLedger>(EMPTY_LEDGER);
  const images = usePendingImages(provider);
  useEffect(() => { void session.activeProvider().then(setProvider); }, [session]);
  const [turn, setTurn] = useState<TurnView>(emptyTurn);
  turnLines.current = turn.lines;
  // Which question is open, and what answering it does; see use-open-ask.ts.
  const { open: openAsk, ask } = useOpenAsk(turnLines.current, setTurn, (message) => {
    submitRef.current(message);
  });
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
    // Reopening by id rather than by stored rows: the preset may have been edited between sessions,
    // and showing the version on disk is the only honest answer to "what is this preset".
    restoreRail: (presetId) => {
      if (presetId === null) railRef.current.close();
      else void railRef.current.commands.open(presetId);
    },
  });

  // `kit -r`, handled once at launch; see use-resume-at-launch.ts.
  useResumeAtLaunch(resume, sessionActions, (text) => add({ role: "say", text }));

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
      // A tool asked for a piece to be SHOWN. The rail takes presets; art takes the rest. The bytes
      // never travelled through the model - it named a piece, and the shell reads the picture itself.
      const shown = event.type === "tool" ? event.show : undefined;
      if (shown && shown.kind !== "preset" && session.art) {
        void session.art.find(shown.id, shown.kind).then((found) => {
          if (!("detail" in found)) add({ role: "portrait", bytes: found.bytes, caption: found.name });
        });
      }
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
      const attached = images.take();
      const nextHistory = await session.runTurn(prompt, before, onEvent, signal, gate.seam(), attached);
      history.current = nextHistory;
      const delta = nextHistory.slice(before.length);
      if (delta.length > 0) {
        // STAMPED PER TURN, so what the rail was on is written down as ordinary work happens and
        // there is nothing to remember to save. Null when the rail is shut, which is also a fact.
        const nextSession = withRail(
          appendTurn(memory.current!, buildTurn(prompt, delta, now())),
          railRef.current.open ? railRef.current.presetId : null,
        );
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
        unlisted: () => session.unlisted?.() ?? Promise.resolve([]),
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
        showImage: (bytes, note, source) => add(imageLine(bytes, note, source)),
        egressSummary: () => formatLedger(ledger),
        contextPreview: () => buildContextPreview(session, history.current, provider),
        folders: session.folders,
        rail: rail.commands,
        gallery: gallery.commands,
        gates: { mode: () => gate.mode, set: (mode) => gate.setMode(mode) },
        art: {
          async show(query) {
            if (!session.art) return { ok: false as const, detail: "This studio has no art seam." };
            const found = await session.art.find(query);
            if ("detail" in found) return { ok: false as const, detail: found.detail };
            add({ role: "portrait", bytes: found.bytes, caption: found.name });
            return { ok: true as const };
          },
        },
        sessions: sessionActions,
        pieces: async (kind: string) =>
          shelf.pieces.filter((p) => p.kind === kind).map((p) => ({ id: p.id, name: p.name })),
      };
      return runCommand(matched.command, ctx, (text) => add({ role: "error", text }));
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

  // The panel sends through this, bound here because submit is declared below the hook that calls it.
  submitRef.current = (message: string) => { submit(message); };

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
      {/* CLICK TO FOCUS, BOTH WAYS: this side is everything that is NOT the rail, so a click here
          means the person is done with it. Only ctrl+B used to give the keyboard back, so typing
          went into the rail, where a letter means rename or note. The composer repeats it for
          itself, since a click on the input must not depend on reaching an ancestor. */}
      <box flexDirection="column" flexGrow={1} minWidth={0} onMouseDown={() => rail.releaseFocus()}>
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
            lines={turn.lines}
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
            {...(openAsk?.index === index
              ? { ask: { state: ask.state, writing: ask.writing, select: ask.select, editNote: ask.editNote } }
              : {})}
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
      {gallery.state.open ? (
        <GalleryStrip state={gallery.state} onSelect={gallery.select} />
      ) : null}
      {/* Modal, but below the Gate: a confirmation outranks it, because that guards the write. */}
      <BlockEditor session={rail.blockEditor} width={termWidth} height={termHeight} onPlace={rail.blockEditor.placeCursor} />
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
        insert={gallery.picked}
        {...(openAsk ? { onAskKey: ask.handleKey } : {})}
        onInserted={() => { gallery.clearPicked(); }}
        onImage={(bytes) => {
          const { note } = images.accept(bytes);
          add(imageLine(bytes, note, "that clipboard image"));
        }}
        onSubmit={submit}
        onFocus={rail.releaseFocus}
        {...(rail.open ? { onStepRail: rail.step, onFocusRail: rail.takeFocus } : {})}
      />
      </box>
        </>
      )}
      </box>
    </box>
  );
}
