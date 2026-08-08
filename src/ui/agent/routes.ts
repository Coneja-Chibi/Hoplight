/**
 * The agent window's routes, in one place.
 *
 * Extracted from the main route table for the ordinary reason (server.ts has a line cap) and one
 * better one: these are the only routes in the app that reach a model or run a tool, and having
 * them adjacent makes the whole of that surface readable at once. What talks to the outside world,
 * and what can write to somebody's studio, should be easy to audit.
 *
 * HOST-ONLY, enforced upstream in server.ts via isHostOnlyRoute. A turn spends the host's API
 * credits against the host's key and can write to the host's studio; a guest who may READ a shared
 * studio has not been handed either of those.
 *
 * Returns null for anything that is not ours, so the caller's table keeps its shape.
 */
import { err, contentTypeIs, json, readJsonCapped } from "../server-security";
import { handleAgentProvider, parseTurn } from "./server-agent";
import { studioEvents } from "./studio-events";
import { runAgentTurn } from "./turn-stream";
import { pendingGates } from "./pending-gates";
import { turnLimit } from "./turn-limit";
import { parseGateAnswer } from "./gate-answer";
import {
  handleProviderActivate,
  handleProviderList,
  handleProviderModels,
  handleProviderRemove,
  handleProviderSave,
  handleProviderTest,
} from "./server-providers";
import { handleCommandComplete, handleCommandList, handleCommandRun } from "./server-commands";

/** Conversations are bigger than settings payloads and much smaller than an upload. */
const TURN_BODY_MAX = 256 * 1024;
const GATE_BODY_MAX = 64 * 1024;

export async function handleAgentRoutes(
  path: string,
  req: Request,
  studioDir: () => string,
): Promise<Response | null> {
  if (!path.startsWith("/api/agent/")) return null;

  /** Which model the window would actually reach. Never the key itself: the vault stays server-side. */
  if (path === "/api/agent/provider") {
    if (req.method !== "GET" && req.method !== "HEAD") return err("method not allowed", 405);
    return handleAgentProvider();
  }

  if (path === "/api/agent/turn") {
    if (req.method !== "POST") return err("method not allowed", 405);
    if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
    const body = await readJsonCapped(req, TURN_BODY_MAX);
    if (!body.ok) return body.response;
    const parsed = parseTurn(body.value);
    if (!parsed.ok) return json({ error: parsed.why }, 400);
    return streamTurn(parsed.value, studioDir(), req.signal);
  }

  /**
   * The answer to a question the agent is holding.
   *
   * A SEPARATE REQUEST, because the turn's own stream is one-way. This is the half that makes the
   * Gate reachable from a browser at all: the dispatch loop is parked on a promise, and this
   * resolves it.
   */
  if (path === "/api/agent/gate") {
    if (req.method !== "POST") return err("method not allowed", 405);
    if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
    const body = await readJsonCapped(req, GATE_BODY_MAX);
    if (!body.ok) return body.response;
    const answer = parseGateAnswer(body.value);
    if (!answer.ok) return json({ error: answer.why }, 400);
    // False means the id is unknown or already settled - a double-click, or a question that timed
    // out while somebody was reading. Reported rather than swallowed, because the two look
    // identical on screen and only one of them means the turn moved on without you.
    const took = pendingGates.answer(answer.value.id, answer.value.choice);
    return json({ accepted: took }, took ? 200 : 409);
  }

  /**
   * Which models this studio can reach, and which one is chosen.
   *
   * KEYS GO ONE WAY. A key may be posted here; nothing here ever sends one back. See
   * server-providers.ts, where the redaction is by construction rather than by deletion.
   */
  if (path.startsWith("/api/agent/providers")) {
    if (path === "/api/agent/providers" && (req.method === "GET" || req.method === "HEAD")) {
      return handleProviderList();
    }
    if (req.method !== "POST") return err("method not allowed", 405);
    if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
    const body = await readJsonCapped(req, GATE_BODY_MAX);
    if (!body.ok) return body.response;
    if (path === "/api/agent/providers/save") return handleProviderSave(body.value);
    if (path === "/api/agent/providers/activate") return handleProviderActivate(body.value);
    if (path === "/api/agent/providers/remove") return handleProviderRemove(body.value);
    if (path === "/api/agent/providers/test") return handleProviderTest(body.value, req.signal);
    if (path === "/api/agent/providers/models") return handleProviderModels(body.value, req.signal);
    return err("not found", 404);
  }

  /**
   * Kit's slash commands.
   *
   * WHY THE SERVER RUNS THEM. A command is a file on disk that reaches the vault, the studio bridge,
   * the grant book and the OS clipboard, so it cannot be imported into a page. Running it here means
   * Kit's own `run()` executes unchanged and the browser applies what it did; see command-core.ts.
   *
   * The listing is what lets the PAGE match with Kit's own matcher before a turn is ever posted,
   * which is the half that stops a command reaching a model as prose.
   *
   * Matched as exact strings, longest first, so `/api/agent/command/complete` is not swallowed by
   * the prefix `/api/agent/command`.
   */
  if (path === "/api/agent/commands") {
    if (req.method !== "GET" && req.method !== "HEAD") return err("method not allowed", 405);
    return handleCommandList();
  }

  if (path === "/api/agent/command/complete" || path === "/api/agent/command") {
    if (req.method !== "POST") return err("method not allowed", 405);
    if (!contentTypeIs(req, "application/json")) return err("unsupported media type", 415);
    // The command line is short; the conversation riding with it for /context and /export is not,
    // and it is bounded by the same cap a turn gets because it is the same conversation.
    const body = await readJsonCapped(req, TURN_BODY_MAX);
    if (!body.ok) return body.response;
    return path === "/api/agent/command"
      ? handleCommandRun(body.value, studioDir(), req.signal)
      : handleCommandComplete(body.value, studioDir());
  }

  /** Studio changes, pushed. One stream answers both "it changed something" and "you changed something". */
  if (path === "/api/agent/events") {
    if (req.method !== "GET") return err("method not allowed", 405);
    return studioEvents(studioDir(), req.signal);
  }

  // A 404 rather than a fall-through: everything under this prefix is ours, and letting an unknown
  // /api/agent/* path reach the static handler would answer it with the HTML shell.
  return err("not found", 404);
}

/** Server-sent events for one turn. */
function streamTurn(
  turn: { messages: readonly { role: string; content: string }[]; brief?: string; sessionId?: string },
  studioDir: string,
  signal?: AbortSignal,
): Response {
  const slot = turnLimit.start();
  if (!slot.ok) {
    // 429 with the wait, so a page that is behaving can back off and one that is not gets refused
    // cheaply. The message says "usually a stuck page" because that is usually what it is.
    return json({ error: slot.why }, 429);
  }

  /** Identifies this turn's questions. Never leaves the process except to the one browser asking. */
  const turnId = `t${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}`;
  const encoder = new TextEncoder();

  const last = turn.messages[turn.messages.length - 1];
  const history = turn.messages
    .slice(0, -1)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (frame: { event: string; data: unknown }): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      try {
        await runAgentTurn({
          studioDir,
          turnId,
          question: last?.content ?? "",
          history,
          ...(turn.brief ? { brief: turn.brief } : {}),
          ...(turn.sessionId ? { sessionId: turn.sessionId } : {}),
          ...(signal ? { signal } : {}),
          emit,
        });
      } finally {
        slot.release();
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* the client already left */ }
        }
      }
    },
    cancel() {
      // The tab closed mid-turn. Deny everything this turn was holding rather than leaving a
      // dispatch loop parked on a question nobody will ever answer.
      pendingGates.abandon(turnId);
      slot.release();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
