/**
 * The turn runner: the imperative shell that ties the loop to the provider and the tools. On each
 * send it resolves the provider (fail-closed), builds the chat and dispatch, runs the ReAct loop, and
 * streams events to the caller. This is the ONE place live egress happens, and only when you send.
 */
import type { KitBridge } from "./bridge";
import { resolveProviderConfig } from "./providers/vault";
import { makeChat } from "./providers/chat";
import { pingProvider, type Probe } from "./providers/probe";
import { discoverTools } from "./tools/discover";
import { makeDispatch, toolSpecs } from "./loop/dispatch";
import {
  makeGatedDispatch,
  type GateSeam,
} from "./tools/safety/gated-dispatch";
import { initGate } from "./tools/safety/permission-mode";
import {
  contentCapabilityAccess,
  createAccessResolver,
} from "./tools/safety/access";
import { runTurn as runLoop, type LoopEvent } from "./loop/loop-core";
import type { ModelMessage, ToolSpec } from "./providers/provider";
import { KIT_TOOL_PROTOCOL } from "./providers/tool-protocol";
import { discoverCapabilities } from "./capabilities/discover";
import { createCapabilityRuntime } from "./capabilities/runtime";
import { createChangeSession } from "./changes/session";
import { reviewChangeDraft } from "./changes/review";
import { createCapabilityFindTool } from "./tools/capability-find";
import { createChangeApplyTool } from "./tools/change-apply";
import { createChangeDiscardTool } from "./tools/change-discard";
import { createChangeQueryTool } from "./tools/change-query";
import type { ContentCapability } from "../entities/capabilities";
import { createHoplightDocs } from "./docs/repository";
import { createResultStore } from "./results/store";
import { StudioExports } from "../studio/exports";

/** What the render sees as a turn unfolds, plus a clean error path (no provider, egress blocked, API
 * failure). begin fires once when the provider resolves (who is about to answer); delta streams live
 * typing/thinking fragments while the reply forms. */
export type TurnEvent =
  | LoopEvent
  | { type: "begin"; label: string }
  | { type: "delta"; kind: "text" | "reasoning"; text: string }
  | { type: "error"; message: string };

export interface Session {
  capabilities?(): readonly ContentCapability[];
  /**
   * What a turn would carry beyond the conversation itself: the standing guidance and the tool belt
   * as it stands right now. Read by /context so a person can see the parts of a request they did not
   * write. Optional for the same reason capabilities() is: a stub session has no belt to report.
   */
  contextSnapshot?(): { system: string; tools: readonly ToolSpec[] };
  runTurn(
    input: string,
    history: ModelMessage[],
    onEvent: (event: TurnEvent) => void,
    signal?: AbortSignal,
    gate?: GateSeam,
  ): Promise<ModelMessage[]>;
  /** /test: ping the active provider once and report its greeting and latency (fail-closed). */
  probe(onEvent: (event: TurnEvent) => void, signal?: AbortSignal): Promise<void>;
  /** Doctor's provider row: the same real ping as /test, returned as structured read-only data. */
  providerProbe?(signal?: AbortSignal): Promise<(Probe & { name: string; model: string }) | null>;
  /** The connected provider's name + model for the status bar, or null if none is set yet. */
  activeProvider(): Promise<{ name: string; model: string; context?: number } | null>;
}

const MAX_STEPS = 12;

/** Build a session bound to a studio bridge. Tools are discovered once; the provider is read per turn. */
export async function createSession(bridge: KitBridge): Promise<Session> {
  const [directTools, capabilities] = await Promise.all([
    discoverTools(),
    discoverCapabilities(),
  ]);
  const changes = createChangeSession();
  const results = createResultStore();
  const runtime = createCapabilityRuntime({
    capabilities,
    directTools,
    changes,
  });
  const lifecycleTools = [
    createCapabilityFindTool(runtime),
    createChangeQueryTool(changes),
    createChangeApplyTool(changes),
    createChangeDiscardTool(changes),
  ];
  const tools = [...runtime.registeredTools(), ...lifecycleTools];
  const dispatch = makeDispatch(tools, {
    bridge,
    changes,
    docs: createHoplightDocs(),
    results,
    // Bound to the same studio this session reads from, so an export always lands beside the
    // pieces it came from and never anywhere the caller chose.
    exports: new StudioExports(bridge.studioDir),
  });
  const lifecycleSpecs = toolSpecs(lifecycleTools);
  const effects = new Map(tools.map((tool) => [tool.name, tool.effect]));
  const activities = new Map(tools.map((tool) => [tool.name, tool.activity]));
  const accessFor = createAccessResolver(
    contentCapabilityAccess(runtime.descriptors()),
  );

  return {
    capabilities: () => capabilities,
    async runTurn(input, history, onEvent, signal, gate) {
      try {
        runtime.beginTurn();
        const config = await resolveProviderConfig();
        if (!config) {
          onEvent({
            type: "error",
            message: "No provider connected. Open setup with /model to add one.",
          });
          return history;
        }
        onEvent({ type: "begin", label: `${config.name ?? config.kind} · ${config.model}` });
        const chat = makeChat(config, signal);
        // Every tool call rides through a per-turn gate. The validated capability catalog contributes
        // exact preview-only names to the security-owned resolver; arbitrary lookalikes remain unknown.
        const gated = makeGatedDispatch(
          dispatch,
          gate ?? { state: initGate() },
          accessFor,
          (call) => {
            if (call.name !== "change_apply") return undefined;
            const args = typeof call.args === "object" && call.args !== null
              ? call.args as { draftId?: unknown }
              : null;
            if (typeof args?.draftId !== "string") return undefined;
            const draft = changes.get(args.draftId);
            return draft ? reviewChangeDraft(draft) : undefined;
          },
        );
        const turn = runLoop(input, history, {
          chat,
          dispatch: gated,
          toolSnapshot: () => [...runtime.toolSnapshot(), ...lifecycleSpecs],
          effectFor: (call) => effects.get(call.name),
          activityFor: (call) => activities.get(call.name),
          maxSteps: MAX_STEPS,
          signal,
          onDelta: (delta) => onEvent({ type: "delta", kind: delta.kind, text: delta.text }),
        });
        let next = await turn.next();
        while (!next.done) {
          onEvent(next.value);
          next = await turn.next();
        }
        return next.value;
      } catch (error) {
        if (signal?.aborted) {
          onEvent({ type: "stopped", reason: "Turn cancelled." });
          return history;
        }
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
        return history;
      }
    },

    async probe(onEvent, signal) {
      try {
        const config = await resolveProviderConfig();
        if (!config) {
          onEvent({ type: "error", message: "No provider connected. Open setup with /model to add one." });
          return;
        }
        const label = `${config.name ?? config.kind} · ${config.model}`;
        onEvent({ type: "begin", label });
        const { text, ms } = await pingProvider(makeChat(config, signal));
        onEvent({ type: "tool", name: "test", summary: `test ${label} · ${ms}ms` });
        onEvent({ type: "say", text: `"${text}"` });
      } catch (error) {
        if (signal?.aborted) {
          onEvent({ type: "stopped", reason: "Provider test cancelled." });
          return;
        }
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
    },

    async providerProbe(signal) {
      const config = await resolveProviderConfig();
      if (!config) return null;
      const result = await pingProvider(makeChat(config, signal));
      return {
        ...result,
        name: config.name ?? config.kind,
        model: config.model,
      };
    },

    // The same belt the loop resolves immediately before each model call, so the preview reports what
    // would actually be offered rather than a stale catalog.
    contextSnapshot: () => ({
      system: KIT_TOOL_PROTOCOL,
      tools: [...runtime.toolSnapshot(), ...lifecycleSpecs],
    }),

    async activeProvider() {
      const config = await resolveProviderConfig();
      if (!config) return null;
      return {
        name: config.name ?? config.kind,
        model: config.model,
        ...(config.context ? { context: config.context } : {}),
      };
    },
  };
}
