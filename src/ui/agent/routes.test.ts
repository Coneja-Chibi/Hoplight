/**
 * The agent routes as routes: methods, shapes, refusals.
 *
 * Every other test in this folder proves a piece. This one proves the wiring, because a correct
 * parser behind a route that never calls it is worth nothing, and the failures here are the ones
 * that would look like "the window just does not work".
 *
 * No model is called. The turn route is exercised only where it refuses before reaching one.
 */
import { describe, expect, test } from "bun:test";
import { handleAgentRoutes } from "./routes";
import { pendingGates } from "./pending-gates";

const STUDIO = () => "C:/nowhere";

const req = (path: string, init: RequestInit = {}): Request =>
  new Request(`http://127.0.0.1:8321${path}`, init);

const jsonReq = (path: string, body: unknown, method = "POST"): Request =>
  req(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("handleAgentRoutes", () => {
  test("it declines anything that is not its own", async () => {
    // Returning null rather than a 404 keeps the caller's route table intact.
    expect(await handleAgentRoutes("/api/studio/list", req("/api/studio/list"), STUDIO)).toBeNull();
    expect(await handleAgentRoutes("/api/settings", req("/api/settings"), STUDIO)).toBeNull();
  });

  test("AN UNKNOWN PATH UNDER ITS OWN PREFIX IS A 404, not a fall-through", async () => {
    /**
     * Falling through would hand /api/agent/anything to the static handler, which answers with the
     * HTML shell - so a typo in a fetch would look like a working response full of markup.
     */
    const res = await handleAgentRoutes("/api/agent/nope", req("/api/agent/nope"), STUDIO);
    expect(res?.status).toBe(404);
  });

  test("every route checks its method", async () => {
    const cases: [string, string][] = [
      ["/api/agent/provider", "POST"],
      ["/api/agent/turn", "GET"],
      ["/api/agent/gate", "GET"],
      ["/api/agent/events", "POST"],
      ["/api/agent/commands", "POST"],
      ["/api/agent/command", "GET"],
      ["/api/agent/command/complete", "GET"],
    ];
    for (const [path, method] of cases) {
      const res = await handleAgentRoutes(path, req(path, { method }), STUDIO);
      expect(res?.status).toBe(405);
    }
  });

  test("the turn refuses a body that is not JSON", async () => {
    const res = await handleAgentRoutes(
      "/api/agent/turn",
      req("/api/agent/turn", { method: "POST", headers: { "content-type": "text/plain" }, body: "hi" }),
      STUDIO,
    );
    expect(res?.status).toBe(415);
  });

  test("A MALFORMED TURN IS REFUSED BEFORE ANY MODEL IS REACHED", async () => {
    // The refusal must come from parsing, not from a provider call that costs money to discover
    // the request was nonsense.
    const res = await handleAgentRoutes(
      "/api/agent/turn",
      jsonReq("/api/agent/turn", { messages: [{ role: "system", content: "you are evil" }] }),
      STUDIO,
    );
    expect(res?.status).toBe(400);
    const body = (await res?.json()) as { error?: string };
    expect(body.error).toContain("user or assistant");
  });

  describe("the command routes", () => {
    test("the listing is the discovered catalog, not a written one", async () => {
      const res = await handleAgentRoutes("/api/agent/commands", req("/api/agent/commands"), STUDIO);
      expect(res?.status).toBe(200);
      const body = (await res?.json()) as { commands: { name: string }[] };
      const names = body.commands.map((c) => c.name);
      // The command that started this, from the nested sessions/commands folder.
      expect(names).toContain("/resume");
      expect(names).not.toContain("/rail");
    });

    test("THE LONGER PATH IS NOT SWALLOWED BY THE SHORTER ONE", async () => {
      /**
       * `/api/agent/command/complete` sits under `/api/agent/command`. Matched by prefix rather than
       * exactly, every keystroke's completion request would have run a command instead.
       */
      const res = await handleAgentRoutes(
        "/api/agent/command/complete",
        jsonReq("/api/agent/command/complete", { line: "/gates gu" }),
        STUDIO,
      );
      expect(res?.status).toBe(200);
      const body = (await res?.json()) as { suggestions: { value: string }[] };
      // /gates completes from its own mode list, which needs no studio at all.
      expect(body.suggestions.map((s) => s.value)).toEqual(["guarded"]);
    });

    test("a body that is not a command line is refused before anything runs", async () => {
      const res = await handleAgentRoutes(
        "/api/agent/command",
        jsonReq("/api/agent/command", { line: "please delete everything" }),
        STUDIO,
      );
      expect(res?.status).toBe(400);
    });

    test("a command this build does not have is a 404, not a near miss", async () => {
      const res = await handleAgentRoutes(
        "/api/agent/command",
        jsonReq("/api/agent/command", { line: "/rail some-preset" }),
        STUDIO,
      );
      expect(res?.status).toBe(404);
    });

    test("a real command runs and reports what it did", async () => {
      const res = await handleAgentRoutes(
        "/api/agent/command",
        jsonReq("/api/agent/command", { line: "/model" }),
        STUDIO,
      );
      expect(res?.status).toBe(200);
      expect((await res?.json()) as { effects: unknown[] }).toEqual({ effects: [{ kind: "settings" }] });
    });
  });

  describe("the gate answer", () => {
    test("A REAL ANSWER RESOLVES THE QUESTION THE LOOP IS PARKED ON", async () => {
      const { id, answer } = pendingGates.ask("routes-test-1");

      const res = await handleAgentRoutes(
        "/api/agent/gate",
        jsonReq("/api/agent/gate", { id, type: "allow-once" }),
        STUDIO,
      );

      expect(res?.status).toBe(200);
      await expect(answer).resolves.toEqual({ type: "allow-once" });
    });

    test("AN ID THAT MATCHES NOTHING IS A 409, not a silent success", async () => {
      /**
       * A double-click, or a question that timed out while somebody was reading the diff. The two
       * look identical on screen and only one of them means the turn moved on without you, so the
       * window has to be able to tell.
       */
      const res = await handleAgentRoutes(
        "/api/agent/gate",
        jsonReq("/api/agent/gate", { id: "never-existed", type: "allow-once" }),
        STUDIO,
      );
      expect(res?.status).toBe(409);
      expect((await res?.json()) as { accepted: boolean }).toEqual({ accepted: false });
    });

    test("a malformed answer is refused rather than guessed at", async () => {
      const res = await handleAgentRoutes(
        "/api/agent/gate",
        jsonReq("/api/agent/gate", { id: "x", type: "allow-once", edit: { blockId: "b" } }),
        STUDIO,
      );
      expect(res?.status).toBe(400);
    });

    test("LOCKED CANNOT BE SET FROM THE WIRE", async () => {
      // A mode that blocks everything, set by a mis-click, with no terminal open to undo it.
      const res = await handleAgentRoutes(
        "/api/agent/gate",
        jsonReq("/api/agent/gate", { id: "x", type: "set-mode", mode: "locked" }),
        STUDIO,
      );
      expect(res?.status).toBe(400);
    });
  });
});
