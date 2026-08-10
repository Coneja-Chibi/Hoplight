/**
 * The agent window's surface.
 *
 * A conversation with whatever model the vault has, standing on whichever screen you came from, with
 * the real tool belt behind it. The window has no provider and no tools of its own: it asks the
 * loopback server, which asks Kit. One vault, one egress ledger, one Gate.
 *
 * THE GATE IS THE POINT OF THE LAYOUT. When the agent wants to write, a card takes over the bottom
 * of this window and a dispatch loop on the server is genuinely parked until it is answered. It is
 * not a confirmation dialog painted after the fact.
 *
 * IT NOTICES THE DISK. The studio-change stream reports the folder rather than an actor, so a file
 * the agent wrote and a file dragged in from Explorer arrive the same way.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from "react";
import type { AppContext } from "../../app-contract";
import { liveSurface } from "../../agent/live-state";
import { briefText, readSurface } from "../../agent/surface";
import { useAgentChat } from "../../agent/use-agent-chat";
import { useStudioChanges } from "../../agent/use-studio-changes";
import { loadDraft, saveDraft } from "../../agent/transcript-store";
import { GateCard } from "../../agent/gate-card";
import { apiFetch, apiFetchJson } from "../../_shared/api-fetch";
import { kitVars } from "../../agent/kit-vars";
import { KeyHints, Rehearsal, RehearsalTrace, Searchlight, Stagehand, WatchNote } from "../../agent/kit-widgets";
import { StatusToast, useNotice } from "../../agent/kit-bands";
import { MeterBar } from "../../agent/kit-meters";
import { Transcript } from "../../agent/kit-transcript";
import { KIT_TRANSCRIPT_STYLE } from "../../agent/kit-transcript-style";
import { KIT_COMMAND_STYLE } from "../../agent/kit-command-style";
import { useKitCommands, type ShellActs } from "../../agent/use-kit-commands";
import { openMentioned } from "../../agent/open-piece";
import { useSlash } from "../../agent/use-slash";
import { useMentions } from "../../agent/use-mentions";
import { SlashMenu } from "../../agent/slash-menu";
import {
  AGENT_CHIP_STYLE, AGENT_GATE_STYLE, AGENT_KIT_STYLE, AGENT_STYLE, AGENT_TALK_STYLE, PREF_BAND_FOLDED,
} from "./styles";

/**
 * Shows the screen the agent can see, and talks to whichever model the vault has.
 *
 * `onClose` is how `/quit` means anything here. A browser cannot exit, so the nearest true thing is
 * closing the panel - and only the panel knows how to do that. Optional, because this same component
 * is also mounted as a dock app, where there is no panel and leaving means going somewhere else.
 */
export function AgentRoom({ ctx, onClose }: { ctx: AppContext; onClose?: () => void }): JSX.Element {
  const [, bump] = useState(0);
  useEffect(() => liveSurface.onChange(() => { bump((n) => n + 1); }), []);

  /**
   * Seeded from storage and written back on every change: leaving this tab UNMOUNTS the app (the
   * shell renders one at a time), so a half-written message would otherwise be gone on return.
   */
  const [draft, setDraftState] = useState(loadDraft);
  const setDraft = useCallback((next: string): void => {
    setDraftState(next);
    saveDraft(next);
  }, []);
  /** The top band folds away and stays folded; it is chrome, and the conversation is not. */
  const [bandFolded, setBandFolded] = useState(() => ctx.prefs.get(PREF_BAND_FOLDED) === true);
  const [traceOpen, setTraceOpen] = useState(false);
  const [model, setModel] = useState<{
    provider?: string;
    model?: string;
    connected: boolean;
    /** The model's context window, present only when the provider reported one. */
    context?: number;
  }>({ connected: false });
  const changes = useStudioChanges();
  const endRef = useRef<HTMLDivElement>(null);
  /**
   * READY TO TYPE THE MOMENT IT OPENS. Ctrl+/ brings this window up because somebody has something
   * to say; landing them in a window they then have to click into is one gesture too many, and it
   * is the gesture nobody thinks to make because the composer looks focused already.
   */
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { composerRef.current?.focus(); }, []);
  /** Local outcomes - "copied" - said once, above the composer, never as a line in the log. */
  const { notice, say } = useNotice();

  const post = useMemo(
    () => (body: unknown, signal: AbortSignal): Promise<Response> =>
      apiFetch("/api/agent/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
    [],
  );
  const postGate = useMemo(
    () => (body: unknown): Promise<unknown> =>
      apiFetchJson("/api/agent/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    [],
  );
  /**
   * The two effects only the window can carry out.
   *
   * SETTINGS IS A DEEP LINK, then a mount. The Settings room reads the hash once, as it comes up, so
   * writing it first is what lands somebody on Models rather than on whichever tab is first. It has
   * one honest limitation: Settings already open on another tab stays where it is, because a mounted
   * component does not re-read the hash.
   */
  const shellActs = useMemo<ShellActs>(() => ({
    openSettings: (): void => {
      window.location.hash = "settings/models";
      ctx.openApp("settings");
    },
    /**
     * The shelf is READ WHEN ASKED, not held. Opening happens once in a while, from a command or a
     * tool, and a list captured when the panel mounted would send somebody to a piece that has been
     * renamed or deleted since - the failure the marker resolver exists to make impossible.
     */
    openPiece: (piece): void => {
      void ctx.api.listEntities()
        .then((all) => {
          if (openMentioned(ctx, piece, all)) return;
          ctx.setStatus(`${piece.kind} ${piece.id} is not in the studio any more`);
        })
        .catch(() => { ctx.setStatus("could not reach the studio to open that piece"); });
    },
    close: (): void => {
      // The panel if there is one; otherwise back to the screen this conversation was about, which
      // is the only "leave" a dock-mounted app can perform.
      if (onClose) { onClose(); return; }
      const published = liveSurface.current();
      if (published) ctx.openApp(published.appId);
    },
  }), [ctx, onClose]);
  const kitCommands = useKitCommands(shellActs);
  const chat = useAgentChat(post, postGate, kitCommands.seam);

  useEffect(() => {
    void apiFetchJson<{
      connected: boolean; provider?: string; model?: string; context?: number;
    }>("/api/agent/provider")
      .then(setModel)
      .catch(() => { setModel({ connected: false }); });
  }, []);

  // Keep the newest line in view; a transcript growing off the bottom looks like nothing happened.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.lines, chat.streaming, chat.gate]);

  const published = liveSurface.current();
  /** The app you came FROM: opening this window is what makes it the active one. */
  const from = published ? ctx.apps().find((m) => m.id === published.appId) : undefined;
  const reading = from
    ? readSurface(
        { id: from.id, title: from.title, ...(from.agentSurface ? { agentSurface: from.agentSurface } : {}) },
        published?.state ?? null,
      )
    : null;
  const brief = reading ? briefText(reading) : undefined;

  const submit = (): void => {
    const text = draft;
    setDraft("");
    void chat.send(text, brief);
  };

  const slash = useSlash(draft, setDraft, kitCommands.seam.catalog, kitCommands.suggest);
  /** Typing @ offers the studio pieces; picking one writes the stable @kind:id marker. */
  const mentions = useMentions(draft, setDraft, ctx);
  /**
   * A row in a command's listing types what a person would have typed.
   *
   * THROUGH `send`, NOT AROUND IT, so choosing "resume this session" and typing `/resume ...` are
   * the same act, matched by the same matcher and recorded the same way. A second path into the
   * command layer is a second set of rules about what may run.
   */
  const acts = useMemo(() => ({
    onSend: (line: string): void => { void chat.send(line, brief); },
    onRewind: chat.rewind,
  }), [chat, brief]);

  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    /**
     * Both popups get first refusal, in the order they can be open. While either is up, Enter
     * completes rather than sends - the alternative is a half-typed "@bas" going out as a question.
     * They cannot both be open: one is triggered by a leading slash and the other by a trailing at.
     */
    if (slash.onKey(event)) return;
    if (mentions.onKey(event)) return;
    // Enter sends, shift+Enter is a newline: the convention every chat box already uses.
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); }
  };

  return (
    <section className="agent-room" style={kitVars()}>
      <style>
        {AGENT_STYLE + AGENT_TALK_STYLE + AGENT_CHIP_STYLE + AGENT_GATE_STYLE + AGENT_KIT_STYLE
          + KIT_TRANSCRIPT_STYLE + KIT_COMMAND_STYLE}
      </style>

      {/*
        THE BAND FOLDS. Provider, title, screen and meter are worth a glance when you arrive and a
        third of a small window forever after - and in the floating panel that third is the part
        you were reading the conversation through. Folded, the one live fact stays: the meter, which
        is the thing you would reopen it to check.
      */}
      <button
        type="button"
        className="agent-room__fold"
        aria-expanded={!bandFolded}
        title={bandFolded ? "Show the model and screen" : "Fold this band away"}
        onClick={() => { setBandFolded(!bandFolded); ctx.prefs.set(PREF_BAND_FOLDED, !bandFolded); }}
      >
        {bandFolded ? "▸" : "▾"}
      </button>

      {!bandFolded && (
      <header className="agent-room__head">
        <p className="agent-room__kick">
          <span className={`agent-room__dot${model.connected ? " agent-room__dot--live" : ""}`} />
          {model.connected ? `${model.provider ?? "model"} · ${model.model ?? ""}` : "no model connected"}
          {/* Said out loud: a window that stopped noticing changes while looking live invites you
              to trust a stale screen. */}
          {changes.watching ? "" : "  ·  not watching the studio folder"}
        </p>
        <h1>The Agent</h1>
        <p className="agent-room__sub">
          {reading
            ? `Standing on ${reading.title}.`
            : "No screen has described itself yet. Open another app and come back."}
        </p>
      </header>
      )}

      {/*
        Kit's meter row: how full the context is, and what the tokens cost. It replaces the bare
        "1400 in / 200 out" that used to ride in the header, which was two facts nobody could act
        on - the thing worth knowing is whether the conversation is about to fall off the front of
        the model's window, and that is a ratio with thresholds on it.
      */}
      <MeterBar tokens={chat.tokens} maxContext={model.context} />

      {!model.connected && (
        <p className="agent-room__notice">
          No model is connected. Add one in Settings; this window uses the same vault and the same
          providers as Kit, so anything set up there works here.
        </p>
      )}

      <section className="agent-room__talk">
        {chat.lines.length === 0 && !chat.streaming && (
          <p className="agent-room__empty">Ask about what is on the screen behind this window.</p>
        )}
        {/*
          Every band, with everything a band can do: the agent's words as markdown, a long reply
          folded, a copy corner on each one, a failure with a red spine, and any question the agent
          asked drawn from the tool's own data rather than parsed back out of its prose.
        */}
        <Transcript
          lines={chat.lines}
          streaming={chat.streaming}
          busy={chat.busy}
          problem={chat.problem}
          acts={acts}
          onFold={chat.setFold}
          onNotice={say}
          onAnswer={(index, message) => { chat.answerChoice(index, message, brief); }}
        />
        {/* THE STAGEHAND NEVER SHARES THE STAGE WITH THE REHEARSAL: Kit shows one or the other. */}
        {chat.busy && chat.rehearsal
          ? <Rehearsal text={chat.rehearsal} startedAt={chat.startedAt} />
          : chat.busy && !chat.streaming && !chat.gate
            ? <Stagehand startedAt={chat.startedAt} />
            : null}
        {!chat.busy && chat.trace && (
          <RehearsalTrace
            text={chat.trace.text}
            seconds={chat.trace.seconds}
            open={traceOpen}
            onToggle={() => { setTraceOpen((v) => !v); }}
          />
        )}
        {/* Something changed on disk that this window did not do. Nobody talking, so it is framed. */}
        {changes.version > 0 && <WatchNote kinds={changes.kinds} />}
        <div ref={endRef} />
      </section>

      {/* What the window itself just did, said once and quietly. Not a line in the conversation. */}
      <StatusToast text={notice} />

      {/* While this is up, a dispatch loop on the server is parked waiting for it. */}
      <GateCard request={chat.gate} onAnswer={chat.answerGate} />

      {/*
        The screen's offered actions, as one-click questions. They stay in the brief either way, so
        the model knows about them whether or not anybody clicks.
      */}
      {reading && reading.actions.length > 0 && model.connected && !chat.gate && (
        <div className="agent-room__chips">
          {reading.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={chat.busy}
              onClick={() => { void chat.send(action.describe, brief); }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/*
        THE POPUP IS A SIBLING OF THE FORM, NOT A CHILD. `.agent-room__composer button` styles the
        Ask and Stop keys and outranks any single-class rule a popup row could carry, so a row placed
        inside the form would silently wear the composer's key styling. One positioned wrapper is
        cheaper than a specificity war.
      */}
      {/*
        WAITING, AND VISIBLY SO. A queued message that sat silently would read as a send that did
        nothing - which is what the old dead composer looked like. Each row says what it is holding
        and offers the two things worth offering: go now, or forget it.
      */}
      {chat.queued.length > 0 && (
        <ul className="agent-room__queue">
          {chat.queued.map((text, at) => (
            <li key={`${String(at)}:${text.slice(0, 24)}`}>
              <span className="agent-room__queuekick">waiting</span>
              <span className="agent-room__queuetext">{text}</span>
              <button type="button" title="Stop the turn and send this now" onClick={() => { chat.sendQueuedNow(at); }}>
                send now
              </button>
              <button type="button" title="Forget this one" onClick={() => { chat.dropQueued(at); }}>
                drop
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="agent-room__compose">
        <SlashMenu title={slash.title} choices={slash.choices} active={slash.active} onPick={slash.pick} />
        <SlashMenu
          title={mentions.title}
          choices={mentions.choices}
          active={mentions.active}
          onPick={mentions.pick}
        />
        <form className="agent-room__composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Searchlight on={chat.busy} />
          <textarea
            ref={composerRef}
            value={draft}
            rows={2}
            /**
             * SPELLCHECKED. This is a sentence somebody is writing to another party; the browser
             * already has the dictionary, and switching it off here would be switching off the only
             * spellchecker in the app.
             */
            spellCheck
            placeholder={model.connected ? "Ask about this screen, or type / for a command" : "Type / for a command, or connect a model in Settings"}
            /**
             * NOT DISABLED WITHOUT A MODEL ANY MORE. Every slash command works without a provider -
             * /doctor and /model are precisely what somebody with no model needs - and a composer
             * that refuses to accept a character is a composer they cannot use to fix it.
             *
             * NOR DURING A TURN. It went dead for the length of an answer, so a thought that arrived
             * while the agent was working had nowhere to go but your memory. Sending now queues it,
             * and the queue drains itself when the turn settles.
             */
            onChange={(e) => { setDraft(e.target.value); }}
            onKeyDown={onComposerKey}
          />
          {/*
            STOP IS A REAL STOP. The abort reaches the provider through the server's request signal,
            so it stops the work and the billing, not just the reading of it.
          */}
          {chat.busy ? (
            <>
              {/* Queue is the primary action while a turn runs; Stop is still one key away. */}
              <button type="submit" disabled={!draft.trim()} title="Send this when the turn finishes">
                {"Queue"}
              </button>
              <button type="button" className="agent-room__stop" onClick={chat.stop}>{"Stop"}</button>
            </>
          ) : (
            <button type="submit" disabled={!draft.trim() || (!model.connected && !draft.trim().startsWith("/"))}>
              {draft.trim().startsWith("/") ? "Run" : "Ask"}
            </button>
          )}
        </form>
      </div>

      {/* Kit CLI signature: a bright key, a muted label. Built and then left unused, which is its
          own small defect - a widget nobody can see is a widget nobody maintains. */}
      <KeyHints
        hints={[
          { key: "enter", label: "send" },
          { key: "shift+enter", label: "newline" },
          { key: "/", label: "commands" },
          { key: "ctrl+/", label: "hide" },
        ]}
      />

      {reading && (
        <details className="agent-room__block">
          <summary>What it can see</summary>
          {/* The brief exactly as the model receives it: checkable because it is readable. */}
          <pre className="agent-room__brief">{brief}</pre>
        </details>
      )}
    </section>
  );
}
