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
import { probeProvider, summariseMessages } from "./session-summarise";
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
import { addNote } from "../core/notes";
import type { OutlineRow } from "../core/preset/outline";
import type { ChangeReceipt } from "./changes/types";
import type { DraftReview, RailSnapshot } from "./tools/tool";
import { reviewChangeDraft } from "./changes/review";
import { crossingForExport } from "./changes/crossing-preview";
import { createCapabilityFindTool } from "./tools/capability-find";
import { offerableTools } from "./belt";
import { createChangeApplyTool } from "./tools/change-apply";
import { createChangeDiscardTool } from "./tools/change-discard";
import { createPresetCopyBlocksTool } from "./tools/preset-copy-blocks";
import { createChangeQueryTool } from "./tools/change-query";
import type { ContentCapability } from "../entities/capabilities";
import { createHoplightDocs } from "./docs/repository";
import { createResultStore } from "./results/store";
import { createGrantBook, type GrantBook } from "./tools/_shared/grant-book";
import { StudioExports } from "../studio/exports";
import { GraveyardStore } from "../studio/graveyard";

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
  /** One toolless call that summarises a conversation; null when it cannot. See session-summarise.ts. */
  summarise(msgs: readonly ModelMessage[], instruction: string, signal?: AbortSignal): Promise<string | null>;
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
    /**
     * `meta` carries the edits that are not about a row: the preset's own name, and a note.
     *
     * A NOTE IS NOT PART OF THE BODY. It lives on the envelope beside `original`, so it survives
     * every conversion untouched and no adapter has to know it exists - which is also why it is
     * applied here rather than inside applyRailEdits, which only ever sees a body.
     */
    stage(
      id: string,
      rows: readonly OutlineRow[],
      meta?: { name?: string; note?: string },
    ): Promise<RailStaged>;
    /** Apply a staged draft once, revision-checked, and report a real receipt. */
    commit(draftId: string): Promise<ChangeReceipt>;
    /** Drop a staged draft nobody will apply, so the next attempt can stage a fresh one. */
    discard(draftId: string): void;
    /**
     * Correct one block inside a staged draft, before it is applied.
     *
     * For the gate: the review shows a nearly-right rewrite, you fix the word, and the thing that
     * gets written is yours. Without this the only routes were accept-then-edit-again, which is two
     * writes and two receipts, or deny and start the whole request over.
     *
     * False when the draft is gone, already applying, or the block is not in it. The caller says so
     * rather than writing something nobody reviewed.
     */
    amendBlock(draftId: string, blockId: string, content: string): boolean;
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
  /** Files in the studio folder that no deck counts, grouped by why. See KitBridge.unlisted. */
  unlisted?(kind?: string): Promise<{ reason: string; count: number; examples: string[] }[]>;
  /** The connected provider's name + model for the status bar, or null if none is set yet. */
  activeProvider(): Promise<{ name: string; model: string; context?: number; images?: boolean } | null>;
}

/**
 * How many model turns one request may take. Twelve capped ambition, not runaway: on a studio whose
 * median preset is 440KB, reading two pieces and staging a draft spent most of them before any
 * thinking happened. Runaway is held by loop-core's tool-call and elapsed budgets plus no-progress
 * detection; this only decides how much a turn is ALLOWED to attempt.
 */
const MAX_STEPS = 64;

/**
 * An id nothing answers to yet, derived from the one asked for.
 *
 * A foreign piece is addressed by a slug, and that slug can equal the source filename when the
 * name was already id-shaped. Writing there would overwrite the file the whole foreign path exists
 * to leave alone, so the copy moves aside until the name is genuinely free.
 */
async function freeId(bridge: KitBridge, base: string): Promise<string> {
  const taken = new Set((await bridge.list("preset")).map((piece) => piece.id));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-copy`;
}

/** Build a session bound to a studio bridge. Tools are discovered once; the provider is read per turn. */
/**
 * `railOf` lets the session read what is on screen. Injected rather than imported: the rail is React
 * state in the shell, and a session that reached into render would invert the dependency the whole
 * file is arranged to avoid.
 */
export async function createSession(
  bridge: KitBridge,
  railOf?: () => RailSnapshot | null,
  /**
   * What this app calls the place a preset opens. Absent keeps the terminal's word, "the rail" -
   * see ToolContext.surface for why a tool must not name the wrong furniture.
   */
  surface?: string,
): Promise<Session> {
  const [discovered, capabilities] = await Promise.all([
    discoverTools(),
    discoverCapabilities(),
  ]);
  // Offer only what this machine can run, engine folders included. See belt.ts.
  const directTools = await offerableTools(discovered, bridge.studioDir);
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
    // Cross-piece, so it cannot be a capability: those preview ONE entity. See the tool header.
    createPresetCopyBlocksTool(changes),
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
    // The block graveyard, bound to this studio. Its own seam: a grave is a drawer, not a shelf.
    graveyard: new GraveyardStore(bridge.studioDir),
    ...(surface === undefined ? {} : { surface }),
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
    unlisted: (kind) => bridge.unlisted?.(kind) ?? Promise.resolve([]),
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
      async stage(id, rows, meta) {
        const entity = await bridge.read("preset", id);
        if (!entity) return { ok: false, detail: `${id} is no longer in the studio.` };
        const body = entity.body as PresetBody;
        const applied = applyRailEdits(body, rows, meta?.name !== undefined ? { name: meta.name } : undefined);
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
        /**
         * EDITING A FOREIGN PIECE MAKES A HOPLIGHT COPY, and that has to be said before it happens.
         *
         * A raw SillyTavern export is read through its adapter and never written to: the id is a
         * slug, so applying writes the slug file while the original name stays exactly as it
         * was. That is the safe behaviour and it is also surprising, because the shelf then holds
         * both. Somebody confirming a rename deserves to know which file they are about to get.
         */
        const summary = (await bridge.list("preset")).find((piece) => piece.id === id);
        const isForeign = summary?.foreign === true;
        /**
         * A FOREIGN EDIT IS A CREATE, NOT AN UPDATE.
         *
         * Two things forced this, and the second is the dangerous one. An update re-reads the stored
         * file to compare revisions, and that file is still a raw export with no canonical envelope,
         * so the read threw and the apply died with "corrupt entity file". Worse: when the source
         * filename already happens to be a valid id, the slug EQUALS it, so the save would have
         * written canonical JSON straight over somebody's SillyTavern export - the exact thing the
         * warning promises never happens.
         *
         * So the copy takes a free id of its own, and the warning names it.
         */
        const copyId = isForeign ? await freeId(bridge, id) : id;
        const foreignWarning = isForeign
          ? [
            "This file is read through the " + (summary?.sourceFormat ?? "source") + " adapter. "
            + "Applying saves a Hoplight copy as \"" + copyId + "\"; the original file is left as it is.",
          ]
          : [];
        // A note is a change even when no block moved, so it is counted before the empty check.
        const noteText = meta?.note?.trim() ?? "";
        const withNote = noteText
          ? addNote({ ...entity, body: applied.body }, noteText, { id: crypto.randomUUID(), at: new Date().toISOString() })
          : { ...entity, body: applied.body };
        if (noteText) changeRows.push({ label: "note added", before: "", after: noteText });
        if (changeRows.length === 0) return { ok: false, detail: "Nothing to apply." };
        const draft = isForeign
          ? changes.create({ ...(withNote as object), id: copyId } as never, {
            capabilityId: "rail.blocks.rearrange",
            input: { id: copyId, blocks: rows.length },
            changes: changeRows.map((row) => ({ path: "/body/prompts", ...row })),
            warnings: foreignWarning,
            platformImpact: [],
          })
          : changes.revise(entity, withNote, {
          capabilityId: "rail.blocks.rearrange",
          input: { id, blocks: rows.length },
          changes: changeRows.map((row) => ({ path: "/body/prompts", ...row })),
          warnings: [
            ...foreignWarning,
            // Removal is the only rail edit that destroys something, so it is the only one that warns.
            ...(applied.removed.length > 0
              ? [`${applied.removed.length} block(s) will be removed: ${applied.removed.join(", ")}`]
              : []),
          ],
          platformImpact: [],
        });
        return { ok: true, draftId: draft.id, review: reviewChangeDraft(draft) };
      },
      commit: (draftId) => applyChangeDraft(changes, bridge, draftId),
      discard: (draftId) => void changes.discard(draftId),
      amendBlock(draftId, blockId, content) {
        const draft = changes.get(draftId);
        if (!draft) return false;
        const body = draft.proposed.body as PresetBody | undefined;
        const prompts = body?.prompts;
        if (!Array.isArray(prompts)) return false;
        // Named and absent is a refusal. Appending or guessing would write a block nobody reviewed.
        if (!prompts.some((prompt) => prompt.id === blockId)) return false;
        const next = {
          ...draft.proposed,
          body: {
            ...body,
            prompts: prompts.map((prompt) =>
              (prompt.id === blockId ? { ...prompt, content } : prompt)),
          },
        } as typeof draft.proposed;
        return changes.amend(draftId, next) !== null;
      },
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

    // Lifted out whole; it is one concept with no session state behind it. See session-summarise.ts
    // for why it is deliberately toolless.
    summarise: summariseMessages,

    // Both lifted whole into session-summarise.ts: one bounded provider call each, no tools, no
    // studio access, and no session state behind either.
    probe: probeProvider,

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
