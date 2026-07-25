/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the session state and composes the
 * render/primitives widgets. Typing runs a turn through the session; its events (say / tool / stopped
 * / error) stream in as the matching widget. No chrome is drawn inline; the look lives in primitives/.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { join } from "node:path";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import type { DeckCount } from "../bridge";
import type { ModelMessage } from "../providers/provider";
import type { Session as ChatSession } from "../session";
import { matchCommand, type KitCommand } from "../commands/command";
import { theme } from "./theme";
import { OpeningBanner } from "./primitives/opening-banner";
import { Playbill } from "./primitives/playbill";
import { Scrollback } from "./primitives/scrollback";
import { YouLine } from "./primitives/you-line";
import { SayLine } from "./primitives/say-line";
import { ToolRow } from "./primitives/tool-row";
import { ErrorRow } from "./primitives/error-row";
import { Composer } from "./primitives/composer/composer";
import { StatusRow } from "./primitives/status-row";
import { ThoughtBox } from "./primitives/thought-box";
import { ThoughtRow } from "./primitives/thought-row";
import { BackstageBox } from "./primitives/backstage-box";
import { BackstageRow } from "./primitives/backstage-row";
import { SearchCard } from "./primitives/nav/search-card";
import { SettingsScreen } from "./settings/settings-screen";
import { applyTurnEvent, settleTurn, toggleTrace, type RenderLine, type TurnView } from "./turn-events";
import { EMPTY_LEDGER, recordEgress, formatLedger, type EgressLedger } from "../providers/egress-ledger";
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

/** Notify defaults: all channels on. Bell/desktop are focus-gated in plan.ts, so they only fire when you
 * looked away; a future /gates command will persist per-channel toggles. */
const NOTIFY_SETTINGS: NotifySettings = { title: true, bell: true, desktop: true };

export interface AppProps {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  session: ChatSession;
  commands: KitCommand[];
  onQuit: () => void;
  sessionStore?: SessionStore;
  makeSessionId?: () => string;
  now?: () => number;
}

/** The window shell: session state plus composed widgets. */
export function App({
  studioName,
  totalPieces,
  decks,
  session,
  commands,
  onQuit,
  sessionStore,
  makeSessionId = newSessionId,
  now = Date.now,
}: AppProps): ReactNode {
  const [busy, setBusy] = useState(false);
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
  const [view, setView] = useState<"session" | "settings" | "sessions">(
    process.env.KIT_SMOKE_VIEW === "settings" ? "settings" : "session",
  );
  const [searching, setSearching] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  const history = useRef<ModelMessage[]>([]);
  const activeTurn = useRef<{ controller: AbortController } | null>(null);
  const store = useRef<SessionStore | null>(null);
  if (!store.current) store.current = sessionStore ?? createSessionStore();
  const memory = useRef<MemorySession | null>(null);
  if (!memory.current) memory.current = emptySession(makeSessionId(), now());
  // Notify: title/bell/desktop fire on the turn's busy falling edge, focus-gated (see notify/plan.ts).
  const focused = useFocus();
  useNotify({ busy, focused, studio: studioName, settings: NOTIFY_SETTINGS });
  const add = (line: RenderLine): void =>
    setTurn((prev) => ({ ...prev, lines: [...prev.lines, line] }));

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

  // Wrap any event-producing work in the turn lifecycle (busy guard, waiting -> settle). One at a time.
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
      }
    })();
    return true;
  };

  const submit = (raw: string): boolean => {
    const value = raw.trim();
    if (!value) return false;
    const matched = matchCommand(commands, value);
    if (matched) {
      const ctx: SessionCommandContext = {
        arg: matched.arg,
        commands,
        decks,
        openSettings: () => setView("settings"),
        quit: onQuit,
        probe: () => startTurn((signal, onEvent) => session.probe(onEvent, signal)),
        say: (text) => add({ role: "say", text }),
        egressSummary: () => formatLedger(ledger),
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
      add({ role: "error", text: `Unknown command: ${value.split(/\s/, 1)[0]}. Try /help.` });
      return true;
    }
    const prompt = escapedSlash ? value.slice(1) : value;
    const accepted = startTurn(async (signal, onEvent) => {
      const before = history.current;
      const nextHistory = await session.runTurn(prompt, before, onEvent, signal);
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
  };

  useKeyboard((event: KeyEvent) => {
    // While the search card is open it owns the keyboard (esc/enter/up/down); the shell stays out of the way.
    if (view !== "session" || searching || rewinding) return;
    if (event.name === "escape" && activeTurn.current) {
      event.preventDefault();
      activeTurn.current.controller.abort();
      return;
    }
    // ctrl+o toggles the latest foldable trace, thought or backstage (plain o would hit the composer)
    if (event.ctrl && event.name === "o") {
      setTurn((prev) => toggleTrace(prev));
      return;
    }
    // ctrl+f drops the script-view transcript search over the conversation
    if (event.ctrl && event.name === "f") {
      event.preventDefault();
      setSearching(true);
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

  return (
    <box id="kit-root" flexDirection="column" backgroundColor={theme.well} width="100%" height="100%">
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
      <Scrollback>
        <OpeningBanner studioName={studioName} totalPieces={totalPieces} animate={turn.lines.length === 0} />
        {turn.lines.map((line, index) =>
          line.role === "you" ? (
            // A blank row before each new your-line: the breathing room falls BETWEEN turns, while a
            // turn's own traces + reply stay grouped tight (scrollback gap is 0). The first line skips it.
            <Fragment key={index}>
              {index > 0 ? <box height={1} /> : null}
              <YouLine text={line.text} />
            </Fragment>
          ) : line.role === "tool" ? (
            <ToolRow key={index} summary={line.text} />
          ) : line.role === "error" ? (
            <ErrorRow key={index} text={line.text} />
          ) : line.role === "thought" ? (
            <ThoughtRow
              key={index}
              text={line.text}
              seconds={line.seconds}
              open={line.open}
              onToggle={() => setTurn((prev) => toggleTrace(prev, index))}
            />
          ) : line.role === "backstage" ? (
            <BackstageRow
              key={index}
              moves={line.moves}
              seconds={line.seconds}
              open={line.open}
              onToggle={() => setTurn((prev) => toggleTrace(prev, index))}
            />
          ) : (
            <SayLine key={index} text={line.text} />
          ),
        )}
        {turn.tools ? <BackstageBox moves={turn.tools.moves} /> : null}
        {turn.live.phase === "typing" ? <SayLine text={turn.live.text} streaming /> : null}
        {turn.live.phase === "thinking" ? (
          <ThoughtBox text={turn.live.text} startedAt={startedAt} />
        ) : null}
        {turn.live.phase === "waiting" && !turn.toolsSeen && !turn.tools ? (
          <StatusRow startedAt={startedAt} />
        ) : null}
      </Scrollback>
      <Composer
        active={turn.live.phase === "waiting" || turn.live.phase === "thinking" || turn.tools != null}
        enabled={!searching}
        provider={provider}
        busy={busy}
        commands={commands}
        onSubmit={submit}
      />
      </box>
        </>
      )}
    </box>
  );
}
