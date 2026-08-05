/**
 * The turn runner: the imperative shell that ties the loop to the provider and the tools. On each
 * send it resolves the provider (fail-closed), builds the chat and dispatch, runs the ReAct loop, and
 * streams events to the caller. This is the ONE place live egress happens, and only when you send.
 */
import type { EntitySummary, KitBridge } from "./bridge";
import type { PresetBody } from "../entities/preset";
import { resolveProviderConfig } from "./providers/vault";
import { spokes } from "./providers/registry";
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
import { ambientContext, KIT_TOOL_PROTOCOL } from "./providers/tool-protocol";
import { discoverCapabilities } from "./capabilities/discover";
import { artFor, resolveArtTarget, type FoundArt } from "./render/art-lookup";
import { createCapabilityRuntime } from "./capabilities/runtime";
import { createChangeSession } from "./changes/session";
import { applyChangeDraft } from "./changes/apply";
import { applyRailEdits, railChangeRows } from "../core/preset/rail-apply";
import type { OutlineRow } from "../core/preset/outline";
import type { ChangeReceipt } from "./changes/types";
import type { DraftReview, RailSnapshot } from "./tools/tool";
import { reviewChangeDraft } from "./changes/review";
import { crossingForExport } from "./changes/crossing-preview";
import { createCapabilityFindTool } from "./tools/capability-find";
import { createChangeApplyTool } from "./tools/change-apply";
import { createChangeDiscardTool } from "./tools/change-discard";
import { createChangeQueryTool } from "./tools/change-query";
import type { ContentCapability } from "../entities/capabilities";
import { createHoplightDocs } from "./docs/repository";
import { createResultStore } from "./results/store";
import { createGrantBook, type GrantBook } from "./tools/_shared/grant-book";
import { StudioExports } from "../studio/exports";

/** What the render sees as a turn unfolds, plus a clean error path (no provider, egress blocked, API
 * failure). begin fires once when the provider resolves (who is about to answer); delta streams live
 * typing/thinking fragments while the reply forms. */
export type TurnEvent =
  | LoopEvent
  | { type: "begin"; label: string }
  | { type: "delta"; kind: "text" | "reasoning"; text: string }
  | { type: "error"; message: string };

/** What staging a rail edit answers with: a draft to confirm, or why it cannot be one. */
export type RailStaged =
  | { ok: true; draftId: string; review: DraftReview }
  | { ok: false; detail: string };

export interface Session {
  capabilities?(): readonly ContentCapability[];
  /**
   * The folders shared with Kit for reading, owned here because the dispatch context reads them.
   * Optional so a stub session stays a stub; /share reports the feature as unavailable rather than
   * pretending a share was recorded.
   */
  folders?: GrantBook;
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
    /** Images pasted into this turn. Sent only if the resolved provider declared it takes them. */
    images?: readonly Uint8Array[],
  ): Promise<ModelMessage[]>;
  /** /test: ping the active provider once and report its greeting and latency (fail-closed). */
  probe(onEvent: (event: TurnEvent) => void, signal?: AbortSignal): Promise<void>;
  /** Doctor's provider row: the same real ping as /test, returned as structured read-only data. */
  providerProbe?(signal?: AbortSignal): Promise<(Probe & { name: string; model: string }) | null>;
  /**
   * The preset seam the rail reads through. On Session rather than as another App prop because the
   * session already holds the bridge and the shell is at its line cap; one narrow capability beats
   * threading storage access through the render tree.
   */
  presets?: {
    list(): Promise<EntitySummary[]>;
    read(id: string): Promise<PresetBody | undefined>;
    /**
     * Compose the rail's edits into a draft. Does NOT write: it returns the review the Gate shows,
     * so the confirmation sits between staging and applying exactly as it does for a model draft.
     */
    stage(id: string, rows: readonly OutlineRow[]): Promise<RailStaged>;
    /** Apply a staged draft once, revision-checked, and report a real receipt. */
    commit(draftId: string): Promise<ChangeReceipt>;
    /** Drop a staged draft nobody will apply, so the next attempt can stage a fresh one. */
    discard(draftId: string): void;
  };
  /**
   * The card-art seam, read-only, on Session for the same reason `presets` is: the session holds the
   * bridge, and threading storage access through the render tree to reach a picture is the wrong
   * direction.
   */
  art?: {
    /** One piece's art by written name, or the reason there is none to show. */
    find(query: string, kind?: string): Promise<FoundArt | { detail: string }>;
    /**
     * Every piece of a deck that HAS art, for the gallery rail.
     *
     * Bounded, and it says when it truncated. A portrait is a base64 image on an entity, so reading a
     * whole deck is the most memory this seam can spend; an unbounded gallery on a large studio is a
     * pause that reads as Kit hanging rather than as a big shelf.
     */
    gallery(kind?: string, limit?: number): Promise<{ found: FoundArt[]; scanned: number; more: boolean }>;
  };
  /** The connected provider's name + model for the status bar, or null if none is set yet. */
  activeProvider(): Promise<{ name: string; model: string; context?: number; images?: boolean } | null>;
}

const MAX_STEPS = 12;

/** Build a session bound to a studio bridge. Tools are discovered once; the provider is read per turn. */
/**
 * `railOf` lets the session read what is on screen. Injected rather than imported: the rail is React
 * state in the shell, and a session that reached into render would invert the dependency the whole
 * file is arranged to avoid.
 */
export async function createSession(
  bridge: KitBridge,
  railOf?: () => RailSnapshot | null,
): Promise<Session> {
  const [directTools, capabilities] = await Promise.all([
    discoverTools(),
    discoverCapabilities(),
  ]);
  const changes = createChangeSession();
  const results = createResultStore();
  const folders = createGrantBook();
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
    // A getter, not a snapshot: this context is built once and every later call reads it, so an array
    // captured here would pin the grants to session start and /share could never take effect.
    get grants() {
      return folders.list();
    },
    // Same reason as grants: read when asked, never captured. The rail changes mid-turn, and a
    // snapshot taken at session start is exactly the stale answer this exists to stop.
    rail: () => railOf?.() ?? null,
  });
  const lifecycleSpecs = toolSpecs(lifecycleTools);
  const effects = new Map(tools.map((tool) => [tool.name, tool.effect]));
  const activities = new Map(tools.map((tool) => [tool.name, tool.activity]));
  const accessFor = createAccessResolver(
    contentCapabilityAccess(runtime.descriptors()),
  );

  /** The narrow read art-lookup needs, adapted from the bridge once rather than at each call site. */
  const artSource = {
    list: async (kind: string) => (await bridge.list(kind)).map((p) => ({ id: p.id, name: p.name })),
    read: (kind: string, id: string) => bridge.read(kind, id),
  };

  return {
    capabilities: () => capabilities,
    folders,
    art: {
      async find(query, kind = "character") {
        const target = await resolveArtTarget(artSource, kind, query);
        if (!target.ok) return { detail: target.detail };
        const art = await artFor(artSource, kind, target.id);
        // "No art" is a real, common answer and not an error: plenty of cards are text only. Naming
        // the piece matters, because the person asked about a specific one.
        return art ?? { detail: `${target.id} carries no card art.` };
      },
      async gallery(kind = "character", limit = 60) {
        const pieces = await artSource.list(kind);
        const found: FoundArt[] = [];
        let scanned = 0;
        for (const piece of pieces) {
          if (found.length >= limit) break;
          scanned++;
          const art = await artFor(artSource, kind, piece.id);
          if (art) found.push(art);
        }
        return { found, scanned, more: scanned < pieces.length };
      },
    },
    presets: {
      list: () => bridge.list("preset"),
      async stage(id, rows) {
        const entity = await bridge.read("preset", id);
        if (!entity) return { ok: false, detail: `${id} is no longer in the studio.` };
        const body = entity.body as PresetBody;
        const applied = applyRailEdits(body, rows);
        // A row naming no prompt means the rail and storage disagree about what exists. Refusing is
        // the only safe answer: writing would drop that block, and inventing one would fabricate it.
        if (applied.unknown.length > 0) {
          return {
            ok: false,
            detail: `The rail is out of step with storage: ${applied.unknown.length} block(s) it`
              + ` shows are not there. Reopen it with /rail.`,
          };
        }
        const changeRows = railChangeRows(body, applied);
        if (changeRows.length === 0) return { ok: false, detail: "Nothing to apply." };
        const draft = changes.revise(entity, { ...entity, body: applied.body }, {
          capabilityId: "rail.blocks.rearrange",
          input: { id, blocks: rows.length },
          changes: changeRows.map((row) => ({ path: "/body/prompts", ...row })),
          // Removal is the only rail edit that destroys something, so it is the only one that warns.
          warnings: applied.removed.length > 0
            ? [`${applied.removed.length} block(s) will be removed: ${applied.removed.join(", ")}`]
            : [],
          platformImpact: [],
        });
        return { ok: true, draftId: draft.id, review: reviewChangeDraft(draft) };
      },
      commit: (draftId) => applyChangeDraft(changes, bridge, draftId),
      discard: (draftId) => void changes.discard(draftId),
      async read(id) {
        const entity = await bridge.read("preset", id);
        return entity ? (entity.body as PresetBody) : undefined;
      },
    },
    async runTurn(input, history, onEvent, signal, gate, images) {
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
        const chat = makeChat(config, signal, () => ambientContext(railOf?.() ?? null));
        // Every tool call rides through a per-turn gate. The validated capability catalog contributes
        // exact preview-only names to the security-owned resolver; arbitrary lookalikes remain unknown.
        const gated = makeGatedDispatch(
          dispatch,
          gate ?? { state: initGate() },
          accessFor,
          (call) => {
            const args = typeof call.args === "object" && call.args !== null
              ? call.args as Record<string, unknown>
              : null;
            if (call.name === "change_apply") {
              if (typeof args?.draftId !== "string") return undefined;
              const draft = changes.get(args.draftId);
              return draft ? { review: reviewChangeDraft(draft) } : undefined;
            }
            // An export is the moment a crossing becomes a file, so it is the moment worth showing
            // what the crossing costs. Built here rather than in the tool because the gate decides
            // BEFORE execute, and a person cannot judge a conversion they have not been shown.
            if (call.name === "studio_export") {
              return crossingForExport(bridge, args).then((crossing) =>
                crossing ? { crossing } : undefined,
              );
            }
            return undefined;
          },
        );
        const spoke = (await spokes()).get(config.kind);
        // THE PROVIDER DECIDES. Attaching an image to a model that cannot read one is not a soft
        // failure, it errors the turn, so an undeclared spoke drops them rather than gambling.
        const attach = spoke?.images === true ? images : undefined;
        const turn = runLoop(input, history, {
          chat,
          ...(attach && attach.length > 0 ? { images: attach } : {}),
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
        // Whether a picture can be SENT is the spoke's answer, not a guess made where it is drawn.
        images: (await spokes()).get(config.kind)?.images === true,
        ...(config.context ? { context: config.context } : {}),
      };
    },
  };
}
