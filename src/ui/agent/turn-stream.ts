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

/** Built once and reused: discovering tools and capabilities reads the disk. */
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
  sessionOnce ??= createSession(studioBridge(studioDir));
  return sessionOnce;
}

/** For tests, and for a studio-folder switch, which invalidates the belt's idea of what exists. */
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
async function gateStateForTurn(): Promise<GateState> {
  const mode: PermissionMode = await readGateMode();
  return { ...initGate(), mode };
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
  readonly signal?: AbortSignal;
  readonly emit: (frame: StreamFrame) => void;
}): Promise<void> {
  const { emit, turnId } = input;

  try {
    const session = await studioSession(input.studioDir);

    /**
     * The screen brief rides as the standing instruction, exactly as it did over the POST: fenced,
     * labelled as data, and built here rather than accepted from the page. What the browser sends is
     * a description of its own screen, never the sentence the model trusts.
     */
    const guidance = systemPrompt(input.brief);
    emit({ event: "begin", data: { turnId } });

    const gateState = await gateStateForTurn();
    /**
     * NAMED BEFORE THE TURN, so every send this turn makes is filed under the provider that made
     * it. Asked once rather than per frame: it reads the vault, and a usage frame arrives for each
     * step of a multi-step turn.
     */
    const provider = (await session.activeProvider())?.name ?? "provider";

    await session.runTurn(
      `${guidance}\n\n${input.question}`,
      input.history.map((m) => ({ role: m.role, content: m.content })),
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
    );

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
