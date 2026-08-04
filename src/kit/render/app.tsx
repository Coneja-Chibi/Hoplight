/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the session state and composes the
 * render/primitives widgets. Typing runs a turn through the session; its events (say / tool / stopped
 * / error) stream in as the matching widget. No chrome is drawn inline; the look lives in primitives/.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { join } from "node:path";
import { useKeyboard, useRenderer } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
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
import { HelpScreen } from "./primitives/nav/help-screen";
import { useScrollSeam } from "./primitives/nav/use-scroll-seam";
import { initNewBelow, trackNewBelow } from "./primitives/nav/scroll-seam";
import { SettingsScreen } from "./settings/settings-screen";
import { applyTurnEvent, settleTurn, toggleTrace, type RenderLine, type TurnView } from "./turn-events";
import { EMPTY_LEDGER, recordEgress, formatLedger, type EgressLedger } from "../providers/egress-ledger";
import { buildContextPreview } from "../context/shell";
import { useNotify } from "./notify/use-notify";
import { useFocus } from "./notify/focus";
import type { NotifySettings } from "./notify/plan";
import { configDir } from "../providers/config";
import { appendTurn, buildTurn, emptySession, forkFrom, renameSession, rewindTo, type Session as MemorySession } from "../sessions/session-model";
import { toHistory } from "../sessions/projection";
import { messagesToLines } from "../sessions/render/replay";
import { ResumePlaybill } from "../sessions/render/resume-playbill";
import { RewindRail } from "../sessions/render/rewind-rail";
import { createSessionStore, newSessionId, type SessionStore } from "../sessions/store";
import { formatTranscript } from "../sessions/transcript";
import type { SessionActions, SessionCommandContext } from "../sessions/session-actions";
import { useCopyNotice } from "./use-copy-notice";
import type { DoctorResult } from "../doctor/check";
import { watchSummary } from "../watch/watch-core";
import type { StudioWatchSource } from "../watch/watcher";
import { GatePrompt } from "./primitives/safety/gate-prompt";
import { useGateController } from "./safety/use-gate";
import { ToolsScreen } from "./tools/tools-screen";
import { useRailSession } from "./rail/use-rail-session";
import { RailPane } from "./rail/rail-pane";

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
}: AppProps): ReactNode {
  const renderer = useRenderer();
  const [busy, setBusy] = useState(false);
  const [studioPieces, setStudioPieces] = useState<readonly EntitySummary[]>(pieces);
  const [studioDecks, setStudioDecks] = useState<DeckCount[]>(decks);
  const [studioTotal, setStudioTotal] = useState(totalPieces);
  const [watchNotices, setWatchNotices] = useState(0);
  const gate = useGateController();
  const rail = useRailSession(session, gate, (text) => add({ role: "say", text }));
  const { notice: copyNotice, copy } = useCopyNotice(renderer);
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
  useNotify({ busy, focused, studio: studioName, settings: NOTIFY_SETTINGS, notice: watchNotices });
  const add = (line: RenderLine): void =>
    setTurn((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  useEffect(() => {
    if (!watchStudio) return;
    return watchStudio((change) => {
      setStudioPieces(change.after);
      setStudioTotal(change.after.length);
      setStudioDecks((current) =>
        current.map((deck) => ({
          ...deck,
          count: change.after.filter((piece) => piece.kind === deck.kind).length,
        })),
      );
      add({ role: "watch", text: watchSummary(change) });
      setWatchNotices((count) => count + 1);
    });
  }, [watchStudio]);

  const selectMemory = (next: MemorySession): void => {
    memory.current = next;
    history.current = toHistory(next);
    setTurn((prev) => ({
      ...prev,
      lines: messagesToLines(history.current),
      live: { phase: "idle" },
      tools: null,
      toolsSeen: false,
    }));
    setRewinding(false);
    setSearching(false);
    setView("session");
  };

  const sessionActions: SessionActions = {
    list: () => store.current!.list(),
    async open(id) {
      if (activeTurn.current) return;
      const next = await store.current!.read(id);
      if (!next) {
        add({ role: "error", text: "That session is missing or unreadable." });
        return;
      }
      selectMemory(next);
    },
    async rename(id, title) {
      if (activeTurn.current) return;
      const found = await store.current!.read(id);
      if (!found) return add({ role: "error", text: "That session is missing or unreadable." });
      const next = renameSession(found, title, now());
      await store.current!.write(next);
      if (memory.current?.id === id) memory.current = next;
    },
    async remove(id) {
      if (activeTurn.current) return;
      await store.current!.remove(id);
      if (memory.current?.id === id) selectMemory(emptySession(makeSessionId(), now()));
    },
    fresh() {
      if (!activeTurn.current) selectMemory(emptySession(makeSessionId(), now()));
    },
    current: () => memory.current!,
    async rewind(turnNumber) {
      if (activeTurn.current) return;
      const next = rewindTo(memory.current!, turnNumber, now());
      await store.current!.write(next);
      selectMemory(next);
    },
    async fork(turnNumber) {
      if (activeTurn.current) return;
      const next = forkFrom(memory.current!, turnNumber, makeSessionId(), now());
      await store.current!.write(next);
      selectMemory(next);
    },
    async exportTranscript(format) {
      if (activeTurn.current) {
        add({ role: "error", text: "Wait for the current turn before exporting." });
        return;
      }
      const transcript = formatTranscript(memory.current!, format);
      const path = await store.current!.writeExport(
        join(configDir(), "exports"),
        transcript.filename,
        transcript.body,
      );
      add({ role: "say", text: `Exported session to ${path}` });
    },
    openPlaybill: () => setView("sessions"),
    openRail: () => setRewinding(true),
  };

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
    const matched = matchCommand(commands, value);
    if (matched) {
      const ctx: SessionCommandContext = {
        arg: matched.arg,
        commands,
        decks: studioDecks,
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

  useKeyboard((event: KeyEvent) => {
    // While the search card is open it owns the keyboard (esc/enter/up/down); the shell stays out of the way.
    if (view !== "session" || searching || rewinding || gate.prompt) return;
    if (event.name === "escape" && activeTurn.current) {
      event.preventDefault();
      activeTurn.current.controller.abort();
      return;
    }
    // ctrl+o toggles the latest folded thought, backstage cluster, or settled long reply.
    if (event.ctrl && event.name === "o") {
      setTurn((prev) => toggleTrace(prev));
      return;
    }
    // ctrl+f drops the script-view transcript search over the conversation
    if (event.ctrl && event.name === "f") {
      event.preventDefault();
      setSearching(true);
      return;
    }
    if (event.name === "end") {
      event.preventDefault();
      scroll.snapToBottom();
    } else if (event.name === "home") {
      event.preventDefault();
      scroll.snapToTop();
    } else if (event.name === "pageup") {
      event.preventDefault();
      scroll.pageBy(-1);
    } else if (event.name === "pagedown") {
      event.preventDefault();
      scroll.pageBy(1);
    }
  });

  if (view === "settings") {
    return (
      <SettingsScreen
        studioName={studioName}
        onClose={() => setView("session")}
        onChanged={() => {
          void session.activeProvider().then(setProvider);
        }}
        onSaved={(config) => {
          setView("session");
          add({ role: "say", text: `Connected ${config.name ?? config.kind}. Talk to your studio.` });
          session.activeProvider().then(setProvider);
        }}
      />
    );
  }
  if (view === "sessions") {
    return (
      <ResumePlaybill
        actions={sessionActions}
        busy={busy}
        onClose={() => setView("session")}
      />
    );
  }
  if (view === "help") {
    return <HelpScreen commands={commands} studioName={studioName} onClose={() => setView("session")} />;
  }
  if (view === "tools") {
    return <ToolsScreen pieces={studioPieces} capabilities={session.capabilities?.() ?? []} studioName={studioName} onClose={() => setView("session")} />;
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
        <OpeningBanner studioName={studioName} totalPieces={studioTotal} animate={turn.lines.length === 0} />
        {turn.lines.map((line, index) => (
          <SettledLine
            key={index}
            line={line}
            index={index}
            pieces={studioPieces}
            onCopy={copy}
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
        decks={studioDecks}
        pieces={studioPieces}
        onSubmit={submit}
      />
      </box>
        </>
      )}
      </box>
    </box>
  );
}
