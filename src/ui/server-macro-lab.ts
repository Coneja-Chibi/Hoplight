/**
 * The Macro Lab's engine routes: what can run here, and run this text through it.
 *
 * A separate module for the reasons the agent and collections routes are: server.ts has a line cap,
 * and a surface that SPAWNS SOMEBODY ELSE'S APPLICATION is easier to audit next to itself.
 *
 * TWO THINGS MAKE THIS DIFFERENT FROM EVERY OTHER ROUTE HERE.
 *
 * First, it is the only one that starts a process on the host's machine on request, so it is
 * host-only (see isHostOnlyRoute) and a tailed-in or LAN device never reaches it. A guest who may
 * read a shared studio has not been handed the ability to run node against the owner's disk.
 *
 * Second, the SillyTavern adapter STAGES INTO THE USER'S OWN INSTALL: it copies the macro folder to
 * a scratch directory inside the checkout, rewrites the copy's imports and removes it on exit. That
 * is fine once, and it is a mess N times over - so renders are serialised per engine here rather
 * than trusted to a disabled button in one tab. preset_verify gets the same protection from its
 * concurrencyKey; this route has no harness and must arrange it itself.
 */
import {
  availableEngines,
  installRoot,
  RENDER_ENGINES,
  isRenderEngineId,
  type RenderEngineId,
} from "../core/preset/render/engines";
import { resolveScratch } from "../core/preset/render/scratch";
import type { RenderIdentity } from "../core/preset/render/contract";
import { contentTypeIs, err, json, readJsonCapped } from "./server-security";

/**
 * One prompt block's worth of text, which is what this surface is for. Someone who wants a whole
 * preset checked wants preset_verify, and buffering a novel here to hand a subprocess is a way to
 * spend the host's memory on a request.
 */
const TEXT_MAX = 32 * 1024;
const BODY_MAX = 128 * 1024;
/** Pretend context is a handful of rows in a panel, not a data store. */
const STATE_KEYS_MAX = 64;
const STATE_VALUE_MAX = 4 * 1024;
const NAME_MAX = 200;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export interface ScratchAsk {
  readonly engine: RenderEngineId;
  readonly text: string;
  readonly state?: Record<string, string>;
  readonly identity?: RenderIdentity;
}

/**
 * Parse a request body into an ask, or say why not.
 *
 * Exported for its own test: this is the only place browser input becomes something handed to a
 * subprocess, and the bounds are the whole of what stops it being an open pipe.
 */
export function parseScratchAsk(
  raw: unknown,
): { ok: true; ask: ScratchAsk } | { ok: false; why: string } {
  if (!isRecord(raw)) return { ok: false, why: "expected an object" };

  const engine = raw["engine"];
  if (!isRenderEngineId(engine)) return { ok: false, why: "unknown engine" };

  const text = raw["text"];
  if (typeof text !== "string") return { ok: false, why: "text must be a string" };
  if (text.length > TEXT_MAX) {
    return { ok: false, why: `text is longer than ${TEXT_MAX} characters` };
  }

  const ask: {
    engine: RenderEngineId;
    text: string;
    state?: Record<string, string>;
    identity?: RenderIdentity;
  } = { engine, text };

  const rawState = raw["state"];
  if (rawState !== undefined && rawState !== null) {
    if (!isRecord(rawState)) return { ok: false, why: "state must be an object" };
    const keys = Object.keys(rawState);
    if (keys.length > STATE_KEYS_MAX) {
      return { ok: false, why: `state carries more than ${STATE_KEYS_MAX} variables` };
    }
    const state: Record<string, string> = {};
    for (const key of keys) {
      const value = rawState[key];
      // Every value, not just the ones we like: a variable silently dropped for being a number
      // would read as "the engine had nothing for it", which is the wrong answer to show.
      if (typeof value !== "string") return { ok: false, why: `state.${key} must be a string` };
      if (key.length > NAME_MAX) return { ok: false, why: "a variable name is too long" };
      if (value.length > STATE_VALUE_MAX) {
        return { ok: false, why: `state.${key} is longer than ${STATE_VALUE_MAX} characters` };
      }
      state[key] = value;
    }
    if (keys.length > 0) ask.state = state;
  }

  const rawWho = raw["identity"];
  if (rawWho !== undefined && rawWho !== null) {
    if (!isRecord(rawWho)) return { ok: false, why: "identity must be an object" };
    const identity: { user?: string; char?: string } = {};
    for (const side of ["user", "char"] as const) {
      const value = rawWho[side];
      if (value === undefined || value === null || value === "") continue;
      if (typeof value !== "string") return { ok: false, why: `identity.${side} must be a string` };
      if (value.length > NAME_MAX) return { ok: false, why: `identity.${side} is too long` };
      identity[side] = value;
    }
    if (identity.user !== undefined || identity.char !== undefined) ask.identity = identity;
  }

  return { ok: true, ask };
}

/**
 * Engines currently rendering. A second press for the same engine is REFUSED rather than queued:
 * queueing turns a mashed button into a backlog of tree copies inside somebody's SillyTavern, and
 * "already running" is a thing the screen can say plainly.
 */
const running = new Set<RenderEngineId>();

/** For tests, which must not inherit a stuck engine from a case that threw. */
export const clearRunningEngines = (): void => running.clear();

async function handleResolve(req: Request): Promise<Response> {
  if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
  const parsed = await readJsonCapped(req, BODY_MAX);
  if (!parsed.ok) return parsed.response;

  const ask = parseScratchAsk(parsed.value);
  if (!ask.ok) return err(ask.why, 400);

  const spec = RENDER_ENGINES[ask.ask.engine];
  const root = await installRoot(ask.ask.engine);
  if (!root) {
    // Named remedy, and never a 200: an absent engine that answered "nothing unresolved" would be
    // the exact false pass this whole surface exists to avoid.
    return err(
      `No ${spec.label} engine on this machine. Set ${spec.rootVar} to ${spec.install}.`,
      422,
    );
  }

  if (running.has(ask.ask.engine)) {
    return err(`${spec.label} is already resolving something. Wait for it to finish.`, 429);
  }
  running.add(ask.ask.engine);
  try {
    const outcome = await resolveScratch({ ...ask.ask, root });
    if (!outcome.ok) {
      return json({ ok: false, reason: outcome.reason, detail: outcome.detail });
    }
    return json({
      ok: true,
      prompt: outcome.prompt,
      unresolved: outcome.unresolved,
      warnings: outcome.warnings,
      // The install PATH is deliberately not forwarded HERE. The browser needs to know which engine
      // and which build answered; where it sits on disk is the host's business.
      //
      // The refusal path above is not equally clean, and saying so beats implying otherwise: an
      // adapter that cannot find its checkout names the path it tried, that text becomes the child's
      // stderr, and runner.ts puts stderr into `detail`. Left as it is on purpose - the route is
      // host-only, so it is the host's own path in the host's own browser, and a person debugging
      // "engine not found" needs to see which path was tried.
      engine: { name: outcome.engine.name, version: outcome.engine.version },
    });
  } finally {
    running.delete(ask.ask.engine);
  }
}

/**
 * Returns null for anything that is not ours, so the caller's route table keeps its shape.
 */
export async function handleMacroLabRoutes(p: string, req: Request): Promise<Response | null> {
  if (p === "/api/macro-lab/engines" && req.method === "GET") {
    const engines = await availableEngines();
    return json({ engines: engines.map((e) => ({ id: e.id, label: e.label })) });
  }
  if (p === "/api/macro-lab/resolve" && req.method === "POST") return handleResolve(req);
  return null;
}
