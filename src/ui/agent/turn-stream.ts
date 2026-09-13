/**
 * One agent turn, streamed, with the Gate carried both ways.
 *
 * THIS REPLACES A REQUEST/RESPONSE POST, and the reason is not speed. A JSON POST can only carry a
 * finished answer, which meant three things at once: no tokens until the very end, no way to show a
 * tool call happening, and - decisively - no way for the dispatch loop to ASK anything. Kit's gate
 * blocks on `requestConfirm` until a human answers, so over one POST the Gate is unreachable by
 * construction. Streaming is what makes tools possible; the live text is the part you get for free.
 *
 * THE SAME SESSION KIT USES. `createSession` over `openStudio`, so this window gets the real tool
 * belt, the real capability runtime, and the real gated dispatch - not a reimplementation. Every
 * write still meets the Gate, and now the Gate is a card in a browser instead of a prompt in a
 * terminal.
 *
 * IT FAILS CLOSED ON THE WAY OUT. When the stream ends for any reason - answered, errored, tab
 * closed, laptop asleep - every question this turn was holding is denied. See pending-gates.ts.
 */
import { createBridge, type KitBridge } from "../../kit/bridge";
import { createSession, type Session, type TurnEvent } from "../../kit/session";
import { initGate } from "../../kit/tools/safety/permission-mode";
import type { GateState, PermissionMode } from "../../kit/tools/safety/gate-core";
import { readGateMode } from "../../kit/tools/safety/gate-store";
import { redactSecrets, systemPrompt } from "./server-agent";
import { pendingGates } from "./pending-gates";
import { noteEgress } from "./agent-ledger";
import { grantPastedPaths } from "../../kit/render/grant-pasted-paths";
import { newWindowSessionId, recordWindowTurn } from "./window-session";
import { compactHistory } from "./compact-history";

/** Built once and reused: discovering tools and capabilities reads the disk. */
/**
 * What this app calls the place a preset opens. The Workbench IS the window's rail: the same preset,
 * the same block order, a surface that was already there rather than a column bolted beside a chat.
 */
export const WINDOW_SURFACE = "the Workbench";

let sessionOnce: Promise<Session> | null = null;
let bridgeOnce: KitBridge | null = null;

/**
 * The studio handle this process reads through.
 *
 * ONE OF THEM, shared with the slash commands. `/decks` needs deck counts and the doctor needs the
 * piece list, and building a second bridge for them would be a second reader of the same folder -
 * cheap here, but the same mistake as a second session, one layer down.
 */
export function studioBridge(studioDir: string): KitBridge {
  bridgeOnce ??= createBridge(studioDir);
  return bridgeOnce;
}

/**
 * The one Kit session this process runs everything through.
 *
 * EXPORTED, AND IT MUST BE. The slash commands need the same session the turn uses, because the
 * GrantBook is session-local: a second session would give `/share` a book nothing else reads, so
 * sharing a folder would report success and grant the model nothing. The art seam, the capability
 * list and the unlisted-files report have the same property, one degree less dangerous.
 */
export function studioSession(studioDir: string): Promise<Session> {
  /**
   * NO RAIL HERE, AND THE WINDOW SAYS SO. There is no second argument because this app has no rail
   * column; the third names what it has instead. Without it rail_open told people their preset was
   * "on the rail" in an app with no rail, while nothing had opened anywhere.
   */
  sessionOnce ??= createSession(studioBridge(studioDir), undefined, WINDOW_SURFACE);
  return sessionOnce;
}

/** For tests and configuration changes that invalidate the session's captured tool belt. */
export function resetAgentSession(): void {
  sessionOnce = null;
  bridgeOnce = null;
}

/**
 * The gate policy this window runs under.
 *
 * READ FROM THE SAME FILE KIT WRITES, so a mode somebody set in the terminal holds here too. One
 * studio, one policy: two places to say "stop asking me" would mean a person who relaxed the
 * terminal was silently strict in the window, or worse, the other way round.
 *
 * `locked` is never persisted by the store, and anything unreadable falls back to guarded.
 */
/**
 * The allowances "allow for this session" builds up. HELD ACROSS TURNS, which is the whole meaning
 * of the words on the button.
 *
 * This used to be `initGate()` per turn - a fresh empty grant set every time - so choosing "allow
 * for session" granted the tool for the rest of THAT turn and was gone by the next question. The
 * same permission got asked for over and over, and answering it changed nothing, which teaches
 * people to click through the prompt that actually matters.
 *
 * Process-scoped, like the session and the bridge beside it: a session ends when the studio server
 * does. The MODE is still read from the file each turn, so a policy set in the terminal holds here.
 */
const sessionGrants = new Set<string>();

/**
 * Remember an allowance as it is chosen.
 *
 * IT CANNOT BE READ BACK OFF THE STATE. `applyGateChoice` is pure - it folds each choice into a NEW
 * state that the dispatch keeps in a turn-local variable - so sharing a Set would still have been
 * thrown away with the turn. The choice itself is the only thing that crosses the boundary, so the
 * choice is what gets recorded.
 */
export function rememberGateChoice(choice: { type?: string } | null, name: string): void {
  if (choice?.type === "allow-session" && name) sessionGrants.add(name);
}

/** What has been allowed for this session so far. For tests; the gate reads it through the state. */
export const gateGrantsForTest = (): ReadonlySet<string> => sessionGrants;

async function gateStateForTurn(): Promise<GateState> {
  const mode: PermissionMode = await readGateMode();
  // A copy, so a turn folding new grants into its own state cannot reach back into this one.
  return { ...initGate(), mode, grants: new Set(sessionGrants) };
}

/** One frame on the wire. Named events so the browser can switch on them without parsing a kind. */
export interface StreamFrame {
  readonly event: string;
  readonly data: unknown;
}

/**
 * Run the turn, calling `emit` for every frame.
 *
 * Returns when the turn is over. Never throws: an error is a frame, because a stream that dies
 * silently leaves a window sitting on "thinking" with nothing to retry.
 */
export async function runAgentTurn(input: {
  readonly studioDir: string;
  readonly turnId: string;
  readonly question: string;
  readonly history: readonly { role: "user" | "assistant"; content: string }[];
  readonly brief?: string;
  /** The window's own saved session, or absent to open a new one. See window-session.ts. */
  readonly sessionId?: string;
  /** Pictures attached to this question, already decoded and bounded by parseTurn. */
  readonly images?: readonly Uint8Array[];
  readonly signal?: AbortSignal;
  readonly emit: (frame: StreamFrame) => void;
}): Promise<void> {
  const { emit, turnId } = input;
  /**
   * NAMED BEFORE ANY WORK, and reported before the first token, so the page owns the id even if the
   * turn then fails. A session minted at the END would be lost by exactly the turns most worth
   * keeping: the ones that broke.
   */
  const sessionId = input.sessionId ?? newWindowSessionId();

  try {
    const session = await studioSession(input.studioDir);

    /**
     * The screen brief rides as the standing instruction, exactly as it did over the POST: fenced,
     * labelled as data, and built here rather than accepted from the page. What the browser sends is
     * a description of its own screen, never the sentence the model trusts.
     */
    const guidance = systemPrompt(input.brief);
    emit({ event: "begin", data: { turnId, sessionId } });

    /**
     * A PATH YOU WROTE IS PERMISSION FOR IT, in this window as it already was in the terminal.
     *
     * grant-pasted-paths.ts has said so since it was written - "somebody who pastes a path and says
     * look at this has already said which file they mean, and being sent to a sharing command first
     * reads as an arbitrary step" - and it was wired into Kit's shell and nowhere else. So naming a
     * file here, with its full path, still got you asked to share it, five times over.
     *
     * ONLY FROM WHAT THE PERSON SUBMITTED, never from anything the model produced. That is the line
     * that keeps this consent rather than a hole: the grants exist so the MODEL cannot wander the
     * disk, and nothing here lets it name its own path.
     */
    if (session.folders) grantPastedPaths(input.question, session.folders, () => {});

    const gateState = await gateStateForTurn();
    /**
     * NAMED BEFORE THE TURN, so every send this turn makes is filed under the provider that made
     * it. Asked once rather than per frame: it reads the vault, and a usage frame arrives for each
     * step of a multi-step turn.
     */
    const provider = (await session.activeProvider())?.name ?? "provider";

    /**
     * COMPACT BEFORE ASKING, when the conversation has filled its share of THIS model's window.
     *
     * Measured in tokens against what the provider says it has room for, because a message count
     * is not a unit of anything - the rule this replaces refused a sixty-message conversation on a
     * 272k model that was ten percent full. Old turns become one summary; the recent end is kept
     * word for word. See compaction-core.ts for the shape and who else lands on it.
     */
    const history = await compactHistory(
      input.history.map((m) => ({ role: m.role, content: m.content })),
      session,
      (await session.activeProvider())?.context ?? 0,
      (note) => { emit({ event: "compacted", data: note }); },
    );
    const all = await session.runTurn(
      `${guidance}\n\n${input.question}`,
      history,
      (event: TurnEvent) => {
        // One usage report is one call that left this machine. This is what `/privacy` reads back;
        // dropping it, as this did, made that command a receipt for nothing.
        if (event.type === "usage") {
          noteEgress({ provider, input: event.usage.input, output: event.usage.output });
        }
        emit(frameFor(event));
      },
      input.signal,
      {
        state: gateState,
        // "Allow for this session" has to outlive the turn it was chosen in, or the same question
        // comes back every time and answering it teaches people to click through.
        onChoice: (choice, name) => { rememberGateChoice(choice, name); },
        /**
         * THE PAUSE, ACROSS A NETWORK. The loop stops here and does not continue until the browser
         * POSTs an answer for this id - or until the question times out, which denies.
         */
        requestConfirm: async (req) => {
          const { id, answer } = pendingGates.ask(turnId);
          emit({
            event: "gate",
            data: {
              id,
              name: req.name,
              peek: req.peek,
              verdict: req.verdict,
              // Passed whole. A warning COUNT with no words is decoration on a decision somebody is
              // being asked to make; the terminal Gate shows the sentences and so does this.
              ...(req.review ? { review: req.review } : {}),
              ...(req.crossing ? { crossing: req.crossing } : {}),
            },
          });
          return answer;
        },
      },
      /**
       * The pictures attached to this question.
       *
       * THE LAST UNWIRED LINK. `runTurn` has always taken these and only ever received undefined
       * from here, so the window could not show the model an image no matter what the provider
       * supported - the one thing somebody wants when they cannot describe a picture in words.
       *
       * Passed as-is because the decision to SEND is not this file's: runTurn attaches them only
       * when the active spoke declared it takes images, so a text-only provider gets a text-only
       * turn rather than a request it would reject.
       */
      input.images,
    );

    /**
     * STAMPED PER TURN, the way the terminal has always done it, so there is nothing to remember to
     * save. Before this the window read sessions and wrote none, so every conversation held here
     * died with the tab and `/resume` could only offer the terminal's.
     */
    const record = await recordWindowTurn({
      sessionId,
      question: input.question,
      messages: all,
      historyLength: history.length,
    });
    /**
     * SAID OUT LOUD, both ways. A turn whose record failed used to be indistinguishable from one
     * that saved, so "my conversations are not being saved" had no evidence behind it on either
     * side. The frame carries the outcome to the page; the console carries it to whoever is running
     * the server, because that is where a filesystem error is worth reading in full.
     */
    if (!record.saved) {
      console.error(`agent: this turn was not saved (${sessionId}): ${record.why}`);
    }
    emit({ event: "session", data: { id: sessionId, ...record } });

    emit({ event: "done", data: {} });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    emit({ event: "failed", data: { error: redactSecrets(detail).slice(0, 400) } });
  } finally {
    /**
     * WHATEVER HAPPENED, NOTHING IS LEFT WAITING. A turn that ended because the tab closed would
     * otherwise hold its questions - and therefore a dispatch loop and a provider connection - until
     * they timed out ten minutes later.
     */
    pendingGates.abandon(turnId);
  }
}

/** Kit's turn events, as frames. A narrow, explicit mapping so nothing internal leaks by accident. */
function frameFor(event: TurnEvent): StreamFrame {
  switch (event.type) {
    case "delta":
      return { event: "delta", data: { kind: event.kind, text: event.text } };
    case "say":
      return { event: "say", data: { text: event.text } };
    case "tool-start":
      return { event: "tool-start", data: { name: event.name } };
    case "tool":
      return {
        event: "tool",
        data: {
          name: event.name,
          summary: event.summary,
          ...(event.show ? { show: event.show } : {}),
          ...(event.choices ? { choices: event.choices } : {}),
        },
      };
    // The window re-reads what it is showing, the way the rail does. The studio watcher cannot
    // carry this: it diffs summaries, and a body edit changes no field it looks at.
    case "wrote":
      return { event: "wrote", data: { kind: event.kind, id: event.id } };
    case "usage":
      return { event: "usage", data: { usage: event.usage } };
    case "state":
      return { event: "state", data: { phase: event.phase } };
    case "stopped":
      return {
        event: "stopped",
        data: {
          reason: event.reason,
          ...(event.budget ? { budget: event.budget } : {}),
          ...(event.recovery ? { recovery: event.recovery } : {}),
        },
      };
    case "begin":
      return { event: "model", data: { label: event.label } };
    case "error":
      return { event: "failed", data: { error: redactSecrets(event.message).slice(0, 400) } };
  }
}
