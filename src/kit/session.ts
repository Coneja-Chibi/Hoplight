/**
 * The turn runner: the imperative shell that ties the loop to the provider and the tools. On each
 * send it resolves the provider (fail-closed), builds the chat and dispatch, runs the ReAct loop, and
 * streams events to the caller. This is the ONE place live egress happens, and only when you send.
 */
import type { KitBridge } from "./bridge";
import { resolveProviderConfig } from "./providers/config";
import { makeChat } from "./providers/chat";
import { discoverTools } from "./tools/discover";
import { makeDispatch, toolSpecs } from "./loop/dispatch";
import { runTurn as runLoop, type LoopEvent } from "./loop/loop-core";
import type { ModelMessage } from "./providers/provider";

/** What the render sees as a turn unfolds, plus a clean error path (no provider, egress blocked, API failure). */
export type TurnEvent = LoopEvent | { type: "error"; message: string };

export interface Session {
  runTurn(
    input: string,
    history: ModelMessage[],
    onEvent: (event: TurnEvent) => void,
  ): Promise<ModelMessage[]>;
}

const MAX_STEPS = 12;

/** Build a session bound to a studio bridge. Tools are discovered once; the provider is read per turn. */
export async function createSession(bridge: KitBridge): Promise<Session> {
  const tools = await discoverTools();
  const dispatch = makeDispatch(tools, { bridge });
  const specs = toolSpecs(tools);

  return {
    async runTurn(input, history, onEvent) {
      const config = await resolveProviderConfig();
      if (!config) {
        onEvent({
          type: "error",
          message: "No provider connected. Set a key (e.g. ANTHROPIC_API_KEY) and restart Kit.",
        });
        return history;
      }
      try {
        const chat = makeChat(config);
        const turn = runLoop(input, history, { chat, dispatch, tools: specs, maxSteps: MAX_STEPS });
        let next = await turn.next();
        while (!next.done) {
          onEvent(next.value);
          next = await turn.next();
        }
        return next.value;
      } catch (error) {
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
        return history;
      }
    },
  };
}
