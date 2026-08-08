/**
 * The window's conversation: what has been said, what is being said, and what is being asked.
 *
 * STREAMING, so three things work that could not before: text appears as it is written, a tool call
 * is visible while it runs, and - the one that matters - the agent can ASK. A gate request parks the
 * dispatch loop on the server until this hook posts an answer back.
 *
 * THE TRANSCRIPT OUTLIVES THE WINDOW. The shell swaps apps through one slot, so leaving the agent
 * tile unmounts it. Holding the conversation in component state meant that navigating away to look
 * at the thing you were discussing threw away the discussion - and since the agent reads the screen
 * you came FROM, going to look at something is the normal way to use it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { matchCommand, type KitCommand } from "../../kit/commands/command";
import { readTurnStream } from "./stream-turn";
import type { ChatLine } from "./turn";
import type { GateAnswerChoice, GateView } from "./gate-card";
import { readChoices } from "./kit-choice-core";
import { NO_TOKENS, foldUsage, type Tokens } from "./kit-meters-core";
import { loadTranscript, saveTranscript } from "./transcript-store";
import { keepTurns, kitLineFor, type CommandEffect } from "./command-core";
import { unknownNote } from "./slash-core";
import { useQueue, useQueueDrain } from "./use-queue";
import { AGENT_SESSION_KEY, readAgentSessionId } from "../_shared/window-memory";
import type { CommandInfo } from "./command-core";

export type { ChatLine } from "./turn";

/**
 * The window's line to Kit's slash commands.
 *
 * Injected rather than fetched here, for the reason `post` is: this hook must be testable without a
 * network, and a window with no command catalog yet must still be a working window.
 */
export interface SlashSeam {
  /** Kit's commands, adapted for Kit's own matcher. */
  readonly commands: readonly KitCommand[];
  /** The same list with the words a listing needs. */
  readonly catalog: readonly CommandInfo[];
  /** Run one, server-side, against Kit's code. The conversation rides along for /context and /export. */
  run: (
    line: string,
    messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[],
  ) => Promise<readonly CommandEffect[]>;
  /** The effects only the window can carry out: changing screen, closing the panel. */
  shell: (effect: CommandEffect) => void;
}

export interface AgentChat {
  readonly lines: readonly ChatLine[];
  /** The answer as it is being typed, before it becomes a line. */
  readonly streaming: string;
  readonly busy: boolean;
  /** The question the agent is holding. While this is set, the server is parked on it. */
  readonly gate: GateView | null;
  readonly problem: string | null;
  /**
   * What the provider said about tokens: the latest turn, and everything since this window opened.
   *
   * TWO NUMBERS, NOT ONE, because Kit's meter and Kit's tally want different things. The turn is
   * OVERWRITTEN per usage report so it reflects the final state of the context; the session ADDS,
   * so it says what the conversation has cost. See kit-meters-core.ts.
   */
  readonly tokens: Tokens;
  /** The model reasoning, live. The stagehand stands down while this has anything in it. */
  readonly rehearsal: string;
  /** The reasoning after it landed, folded to a trace. */
  readonly trace: { text: string; seconds: number } | null;
  /** When the running turn began; 0 between turns. */
  readonly startedAt: number;
  send: (text: string, brief?: string) => Promise<void>;
  answerGate: (choice: GateAnswerChoice) => void;
  /**
   * Fold or reopen a long reply. An explicit choice overrules the newest-reply-is-open rule.
   *
   * THE CALLER SAYS WHICH WAY, rather than this flipping whatever it finds. `open` is undefined
   * until somebody clicks, so "flip it" has no answer for a line that has never been touched - and
   * guessing produced a dead first click on every reply that was already folded by position.
   */
  setFold: (index: number, open: boolean) => void;
  /**
   * Answer an `ask_choice` panel: the message goes as an ordinary turn, and the panel it came from
   * collapses to what was said so the same question cannot be answered twice.
   */
  answerChoice: (index: number, message: string, brief?: string) => void;
  /** Stop the turn in flight. The abort reaches the provider, not just the browser. */
  stop: () => void;
  /** Scrub this conversation back to its first `keep` turns. The rewind picker's rows call it. */
  rewind: (keep: number) => void;
  clear: () => void;
  /** Messages typed during a turn, oldest first. They drain themselves when the turn settles. */
  readonly queued: readonly string[];
  /** Forget one without sending it. */
  dropQueued: (at: number) => void;
  /** Stop what is running and send this one now. */
  sendQueuedNow: (at: number) => void;
}

/** Posts a turn and returns the raw streaming Response. Injected so tests never touch the network. */
export type PostTurn = (body: unknown, signal: AbortSignal) => Promise<Response>;
/** Posts a gate answer. */
export type PostGate = (body: unknown) => Promise<unknown>;

export function useAgentChat(post: PostTurn, postGate: PostGate, slash?: SlashSeam): AgentChat {
  const [lines, setLines] = useState<readonly ChatLine[]>(() => loadTranscript());
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<GateView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Tokens>(NO_TOKENS);
  /** The live thought, while it is happening. Empty between turns. */
  const [rehearsal, setRehearsal] = useState("");
  /** The landed thought, folded. Kept until the next turn starts. */
  const [trace, setTrace] = useState<{ text: string; seconds: number } | null>(null);
  /** When this turn began, for every clock Kit stamps. */
  const [startedAt, setStartedAt] = useState(0);

  const linesRef = useRef(lines);
  linesRef.current = lines;
  const busyRef = useRef(false);
  /**
   * The slash seam, RIDING A REF so the turn runner stays stable.
   *
   * The seam is rebuilt whenever the shell's AppContext is - which is every store action, by that
   * layer's deliberate design - so depending on it directly would rebuild the send callback
   * constantly, in the middle of streaming turns. A ref keeps one callback that always reads the
   * current seam, the same trick the studio shelf uses for its notice.
   */
  const slashRef = useRef(slash);
  slashRef.current = slash;
  /** The saved session this tab writes to, restored on mount so a reload keeps writing to it. */
  const sessionIdRef = useRef<string>(readAgentSessionId());
  const abortRef = useRef<AbortController | null>(null);
  /** Typed during a turn and waiting. See use-queue.ts. */
  const queue = useQueue();

  // Persisted on every change, so an unmount mid-conversation loses nothing.
  useEffect(() => { saveTranscript(lines); }, [lines]);

  /**
   * Post a turn to the model.
   *
   * SEPARATE FROM `send` SO THE COMMAND CHECK CANNOT BE SKIPPED BY ACCIDENT, and so that the one
   * caller that must skip it can. See `send` and `answerChoice`.
   */
  const sendTurn = useCallback(async (text: string, brief?: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    /**
     * ONE TURN AT A TIME, checked on a REF. Two clicks in the same tick both read `busy === false`
     * from a stale render and both fire, which bills twice and interleaves two answers.
     */
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    setStreaming("");
    /**
     * THE TURN'S COUNTS RESET AND THE SESSION'S DO NOT. A meter that started over every turn would
     * be a meter of nothing; the running total is what says what this conversation has cost, and
     * this window is the only place it is kept.
     */
    setTokens((prior) => ({ ...NO_TOKENS, session: prior.session }));

    const conversation = [...linesRef.current, { role: "user" as const, text: trimmed }];
    /**
     * APPENDED FUNCTIONALLY, not assigned from the snapshot above.
     *
     * `conversation` is what the model is sent, and it is built from the ref because the ref is the
     * settled truth. Writing that same array back into state would DISCARD any update queued in the
     * same batch - which is exactly what answering an `ask_choice` panel does: it marks its line
     * answered and then sends, and an assignment here would silently undo the mark and leave a live
     * panel on a question that has already been answered.
     */
    setLines((prior) => [...prior, { role: "user" as const, text: trimmed }]);

    const controller = new AbortController();
    abortRef.current = controller;
    /** Accumulated here rather than read back off state, which lags a frame behind the stream. */
    let sofar = "";
    let thinking = "";
    const began = Date.now();
    setStartedAt(began);
    setRehearsal("");
    setTrace(null);

    try {
      const response = await post(
        {
          messages: conversation
            /**
             * Tool lines are the window's own narration, and `kit` lines are a slash command's
             * output. NEITHER IS SOMETHING ANYBODY SAID. Letting a `/decks` listing through would
             * post a description of somebody's private folder as though the model had written it,
             * and the model would then be reasoning against its own supposed words.
             */
            .filter((l): l is ChatLine & { role: "user" | "assistant" } => l.role === "user" || l.role === "assistant")
            .map((l) => ({ role: l.role, content: l.text })),
          ...(brief ? { brief } : {}),
          // Absent on the very first turn of a tab; the server names one and the next turn carries it.
          ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
        },
        controller.signal,
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setProblem(body?.error ?? `The server refused the turn (${String(response.status)}).`);
        return;
      }

      await readTurnStream(response, {
        onDelta: (kind, text) => {
          /**
           * REASONING IS NOT THE REPLY, and Kit does not throw it away either: it streams into the
           * rehearsal box while the model works, then folds into a one-line trace. Dropping it, as
           * this did, meant the window went silent during exactly the part of a turn that takes
           * longest and looked most like a hang.
           */
          if (kind === "reasoning") {
            thinking += text;
            setRehearsal(thinking);
            return;
          }
          sofar += text;
          setStreaming(sofar);
        },
        onSay: (text) => {
          const said = text.trim() || sofar.trim();
          sofar = "";
          setStreaming("");
          if (said) setLines((prior) => [...prior, { role: "assistant", text: said }]);
        },
        onToolStart: (name) => {
          setLines((prior) => [...prior, { role: "tool", text: `${name}...`, tool: name }]);
        },
        /**
         * A tool asked for a piece to be opened. THE SAME DOOR `/rail` USES: routed through the
         * shell effect rather than a second opener, so the model's rail_open and the person's typed
         * command land the piece in exactly the same place by exactly the same code.
         */
        onShow: (piece) => { slashRef.current?.shell({ kind: "open", piece }); },
        /**
         * The session this conversation is being saved into. Kept per TAB, so a reload continues the
         * same file rather than starting a second one beside it and splitting the record in half.
         */
        onSession: (id) => {
          sessionIdRef.current = id;
          try { sessionStorage.setItem(AGENT_SESSION_KEY, id); } catch { /* storage unavailable */ }
        },
        // Said on screen, because a conversation quietly not being saved is the one failure you
        // cannot notice until you go looking for it.
        onUnsaved: (why) => { setProblem(`This turn was not saved: ${why}`); },
        onTool: (name, summary, choices) => {
          /**
           * A QUESTION IS PART OF THE CALL THAT ASKED IT. `ask_choice` puts its list on this frame,
           * parsed once here at the boundary: a payload that does not read as a question leaves an
           * ordinary tool row rather than a broken panel.
           */
          const asked = readChoices(choices);
          /**
           * REPLACE THE ROW THAT WAS WAITING, WHEREVER IT IS.
           *
           * This used to check only the LAST line, which is right for one call at a time and wrong
           * for every reply that declares several. The loop starts them together, so the transcript
           * held three "studio_read..." rows and each completion appended BESIDE them - a column of
           * calls that never resolved, next to results with nothing to attach them to.
           *
           * Searched backwards for the newest unfinished row with this name: two calls to the same
           * tool in one reply finish in an order nobody controls, and the newest is the one a person
           * is watching.
           */
          setLines((prior) => {
            const line: ChatLine = {
              role: "tool",
              text: `${name}: ${summary}`,
              tool: name,
              ...(asked ? { choices: asked } : {}),
            };
            const waiting = `${name}...`;
            for (let at = prior.length - 1; at >= 0; at--) {
              const row = prior[at];
              if (row?.role === "tool" && row.text === waiting) {
                const next = [...prior];
                next[at] = line;
                return next;
              }
            }
            // No row was waiting - a result with no start frame. Shown rather than dropped.
            return [...prior, line];
          });
        },
        onGate: (request) => { setGate(request as GateView); },
        onUsage: (u) => { setTokens((prior) => foldUsage(prior, u)); },
        onStopped: (reason, recovery) => {
          setProblem(recovery ? `${reason} ${recovery}` : reason);
        },
        onFailed: (error) => { setProblem(error); },
      });

      // A stream that ended mid-sentence still has words worth keeping.
      if (sofar.trim()) {
        setLines((prior) => [...prior, { role: "assistant", text: sofar.trim() }]);
        setStreaming("");
      }
      // The rehearsal bows out into a trace: still there, no longer taking the stage.
      if (thinking.trim()) {
        setTrace({ text: thinking.trim(), seconds: (Date.now() - began) / 1000 });
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      setBusy(false);
      setRehearsal("");
      // Whatever happened, no question is left on screen implying the server is still waiting.
      setGate(null);
    }
  }, [post]);

  /**
   * Run one matched command server-side and apply what it did.
   *
   * THE LOCK IS CLAIMED IN THIS FUNCTION'S SYNCHRONOUS PROLOGUE, before the first `await`, exactly
   * as `sendTurn` claims it. An async function runs straight through to its first suspension, so a
   * caller that reaches this in the same tick as another one finds `busy` already true. Deciding
   * this behind an `await` instead would reopen the double-fire `busyRef` exists to close.
   */
  const runCommandLine = useCallback(async (line: string): Promise<void> => {
    if (!slash || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    try {
      /**
       * THE CONVERSATION GOES WITH IT, because two commands are about it: /context previews what the
       * next request would carry, and /export writes this conversation out. Kit lines are left
       * behind - a command's own output is not part of the conversation it is reporting on.
       */
      const effects = await slash.run(
        line,
        linesRef.current
          .filter((l): l is ChatLine & { role: "user" | "assistant" } => l.role === "user" || l.role === "assistant")
          .map((l) => ({ role: l.role, content: l.text })),
      );
      for (const effect of effects) {
        if (effect.kind === "transcript") {
          setLines(effect.lines.map((l) => ({ role: l.role, text: l.text })));
          continue;
        }
        /**
         * A RESUME MOVES WHERE THIS WINDOW WRITES. Without it the resumed conversation was on
         * screen while the next turn was saved into a different file - so restarting and resuming
         * the same chat showed everything except what you had just said to it.
         */
        if (effect.kind === "session") {
          sessionIdRef.current = effect.id;
          try { sessionStorage.setItem(AGENT_SESSION_KEY, effect.id); } catch { /* unavailable */ }
          continue;
        }
        const drawn = kitLineFor(effect);
        if (drawn) { setLines((prior) => [...prior, drawn]); continue; }
        slash.shell(effect);
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [slash]);

  /**
   * Drain one queued message when the turn that blocked it settles.
   *
   * WATCHING `busy` RATHER THAN CALLING FROM THE `finally`, because the sender is defined below
   * this point and reaching it from there would need a ref threaded through two closures. The lock
   * is claimed in the sender's synchronous prologue, so the effect cannot double-send: by the time
   * it could run again, busy is true.
   */
  const sendRef = useRef<(text: string, brief?: string) => Promise<void>>(async () => {});
  const briefRef = useRef<string | undefined>(undefined);

  /**
   * The one door in. Anything a person typed comes through here, and a command never leaves it.
   *
   * THE DECISION IS SYNCHRONOUS, on purpose. Every branch below reaches its dispatcher without an
   * `await` in front of it, so whichever one is taken claims the turn lock in the same tick the
   * click happened.
   */
  const send = useCallback(async (text: string, brief?: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    /**
     * A SEND DURING A TURN IS QUEUED, NOT DROPPED. This used to return here and the words were
     * simply gone - the composer was disabled anyway, so a thought that arrived mid-answer had
     * nowhere to go. It now waits its turn and drains when this one settles.
     */
    if (busyRef.current) {
      if (!queue.add(trimmed)) {
        setProblem("The queue is full. Send this once a turn has finished.");
      }
      return;
    }
    /**
     * `//` IS KIT'S ESCAPE, and it has to exist here for the same reason it exists there: once a
     * leading slash is a command, a message that genuinely begins with one has no other way out.
     * One slash comes off and the rest goes to the model as ordinary prose.
     */
    if (trimmed.startsWith("//")) return sendTurn(trimmed.slice(1), brief);
    if (slash && trimmed.startsWith("/")) {
      const matched = matchCommand(slash.commands, trimmed);
      /**
       * A `/` LINE THAT MATCHED NOTHING IS STILL NOT A QUESTION. "/reusme" is a typo, and forwarding
       * it would spend a turn having a model puzzle over somebody's mis-keystroke - the more
       * expensive of the two wrong answers.
       */
      if (!matched) {
        setLines((prior) => [...prior, { role: "kit", text: unknownNote(slash.catalog, trimmed.split(/\s/, 1)[0] ?? trimmed) }]);
        return;
      }
      return runCommandLine(trimmed);
    }
    return sendTurn(trimmed, brief);
  }, [slash, runCommandLine, sendTurn, queue]);

  const answerGate = useCallback((choice: GateAnswerChoice) => {
    const open = gate;
    if (!open) return;
    // Cleared immediately: the loop resumes the moment the server has this, and a card that lingered
    // could be answered twice.
    setGate(null);
    void postGate({ id: open.id, ...choice }).catch(() => {
      setProblem("That answer did not reach the agent. The change was not made.");
    });
  }, [gate, postGate]);

  const setFold = useCallback((index: number, open: boolean) => {
    /**
     * The choice is written ONTO THE LINE, not into a separate map. Kit's fold rule reads `open`
     * off the line itself so that "somebody chose this" outranks "this is the newest reply", and a
     * side table would have to be kept in step with a list that grows on every frame.
     */
    setLines((prior) => prior.map((line, at) => (at === index ? { ...line, open } : line)));
  }, []);

  const answerChoice = useCallback((index: number, message: string, brief?: string) => {
    /**
     * BOTH HALVES OR NEITHER. `send` refuses while a turn is running - one turn at a time - so
     * marking the panel answered first and sending afterwards could collapse a question to an
     * answer that never left, which is the worst of the three possible outcomes: it looks answered,
     * the model never heard it, and there is no way back to the options.
     */
    if (busyRef.current) return;
    /**
     * Marked answered, then sent. The panel collapses to what was said the moment the answer
     * leaves, so the same question cannot be answered twice while the turn it started is running.
     */
    setLines((prior) => prior.map((line, at) => (at === index ? { ...line, answered: message } : line)));
    /**
     * STRAIGHT TO THE TURN, DELIBERATELY BYPASSING THE COMMAND MATCHER.
     *
     * This text came out of an `ask_choice` payload, which the MODEL wrote. Routed through `send` it
     * would be matched like something somebody typed, so a choice labelled `/gates full` would
     * quietly relax the permission that decides whether the model's next write is reviewed. A model
     * must never be able to invoke a local command by naming one in an answer it authored.
     */
    void sendTurn(message, brief);
  }, [sendTurn]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const rewind = useCallback((keep: number) => {
    // Refused mid-turn rather than racing the stream: the reply still arriving would land on a
    // conversation that no longer has the question it is answering.
    if (busyRef.current) return;
    setLines((prior) => keepTurns(prior, keep));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setProblem(null);
    setStreaming("");
    // The session total goes with the conversation it was counting.
    setTokens(NO_TOKENS);
  }, []);

  // The sender, reachable from the drain without threading it through two closures.
  sendRef.current = send;
  const waiting = useQueueDrain({ queue, busy, blocked: gate !== null, send: sendRef, brief: briefRef, stop });

  return {
    lines, streaming, busy, gate, problem, tokens, rehearsal, trace, startedAt,
    send, answerGate, setFold, answerChoice, stop, rewind, clear, ...waiting,
  };
}
