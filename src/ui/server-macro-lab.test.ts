/**
 * The Macro Lab route's boundary: what it accepts from a browser before handing a subprocess a file.
 *
 * The bounds are the whole of what stops this being an open pipe into someone else's application, so
 * they are asserted rather than assumed. The engine-absent case matters just as much: an absent
 * engine that answered 200 with nothing unresolved would read on screen as "your macros are fine",
 * which is the one answer this surface must never invent.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { RENDER_ENGINES } from "../core/preset/render/engines";
import {
  clearRunningEngines,
  handleMacroLabRoutes,
  parseScratchAsk,
} from "./server-macro-lab";

const post = (body: unknown): Request =>
  new Request("http://127.0.0.1/api/macro-lab/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/**
 * The engine roots are read from the process environment, so a test that clears them must put back
 * exactly what it found - including "it was not set at all", which is not the same as "". A suite
 * that leaks HOPLIGHT_ST_ROOT="" would silently retire the live render tests for everything after it.
 */
const ENV_KEYS = Object.values(RENDER_ENGINES).map((e) => e.rootVar);
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  clearRunningEngines();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("parseScratchAsk", () => {
  it("accepts the smallest real ask", () => {
    const out = parseScratchAsk({ engine: "sillytavern", text: "hi {{char}}" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.ask.engine).toBe("sillytavern");
      expect(out.ask.state).toBeUndefined();
      expect(out.ask.identity).toBeUndefined();
    }
  });

  it("refuses an engine nothing here can run", () => {
    // Not a typo guard: rolecall and lumiverse are real macro LENSES with no runtime on this
    // machine, so the name looks plausible and the answer must still be no.
    for (const engine of ["rolecall", "lumiverse", "full", "", 7]) {
      const out = parseScratchAsk({ engine, text: "x" });
      expect(out.ok).toBe(false);
    }
  });

  it("refuses text that is not a string, and text past the cap", () => {
    expect(parseScratchAsk({ engine: "marinara", text: 12 }).ok).toBe(false);
    expect(parseScratchAsk({ engine: "marinara", text: "x".repeat(32 * 1024 + 1) }).ok).toBe(false);
    expect(parseScratchAsk({ engine: "marinara", text: "x".repeat(32 * 1024) }).ok).toBe(true);
  });

  it("keeps empty text, which is a legitimate thing to ask", () => {
    const out = parseScratchAsk({ engine: "marinara", text: "" });
    expect(out.ok).toBe(true);
  });

  it("carries state through, and refuses a non-string value rather than dropping it", () => {
    const good = parseScratchAsk({ engine: "marinara", text: "x", state: { mood: "calm" } });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.ask.state).toEqual({ mood: "calm" });

    // Dropping it would show as "the engine had nothing for that variable", which is a different
    // and wrong answer.
    expect(parseScratchAsk({ engine: "marinara", text: "x", state: { n: 1 } }).ok).toBe(false);
    expect(parseScratchAsk({ engine: "marinara", text: "x", state: "nope" }).ok).toBe(false);
  });

  it("bounds the number of variables and the size of each", () => {
    const many = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`v${i}`, "x"]));
    expect(parseScratchAsk({ engine: "marinara", text: "x", state: many }).ok).toBe(false);
    const big = { v: "x".repeat(4 * 1024 + 1) };
    expect(parseScratchAsk({ engine: "marinara", text: "x", state: big }).ok).toBe(false);
  });

  it("treats an empty name as naming nobody, so the engine keeps its own default", () => {
    const out = parseScratchAsk({
      engine: "marinara",
      text: "x",
      identity: { user: "", char: "Seraphina" },
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.ask.identity).toEqual({ char: "Seraphina" });
  });

  it("drops identity entirely when neither side was named", () => {
    const out = parseScratchAsk({ engine: "marinara", text: "x", identity: { user: "", char: "" } });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.ask.identity).toBeUndefined();
  });
});

describe("the resolve route", () => {
  it("refuses with a named remedy when the engine is not on this machine", async () => {
    for (const key of ENV_KEYS) delete process.env[key];

    const res = await handleMacroLabRoutes(
      "/api/macro-lab/resolve",
      post({ engine: "sillytavern", text: "{{char}}" }),
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(422);
    const body = (await res!.json()) as { error: string };
    // The remedy names the variable to set, because "not available" alone is not actionable.
    expect(body.error).toContain("HOPLIGHT_ST_ROOT");
  });

  it("reports no engines when this machine has none", async () => {
    for (const key of ENV_KEYS) delete process.env[key];

    const res = await handleMacroLabRoutes(
      "/api/macro-lab/engines",
      new Request("http://127.0.0.1/api/macro-lab/engines"),
    );
    expect(res).not.toBeNull();
    expect(await res!.json()).toEqual({ engines: [] });
  });

  it("refuses a body that is not json", async () => {
    const res = await handleMacroLabRoutes(
      "/api/macro-lab/resolve",
      new Request("http://127.0.0.1/api/macro-lab/resolve", { method: "POST", body: "x" }),
    );
    expect(res!.status).toBe(415);
  });

  it("returns null for a path that is not ours, so the caller's table keeps its shape", async () => {
    const res = await handleMacroLabRoutes(
      "/api/formats",
      new Request("http://127.0.0.1/api/formats"),
    );
    expect(res).toBeNull();
  });

  it("does not answer a GET-only route to a POST, or the reverse", async () => {
    const asPost = await handleMacroLabRoutes(
      "/api/macro-lab/engines",
      new Request("http://127.0.0.1/api/macro-lab/engines", { method: "POST" }),
    );
    expect(asPost).toBeNull();
    const asGet = await handleMacroLabRoutes(
      "/api/macro-lab/resolve",
      new Request("http://127.0.0.1/api/macro-lab/resolve"),
    );
    expect(asGet).toBeNull();
  });
});

/**
 * The concurrency refusal, against a real engine because there is no honest way to fake it.
 *
 * SillyTavern's adapter copies its macro folder into the user's own checkout, rewrites the copy and
 * removes it on exit. Two of those at once inside one install is the failure this guard exists to
 * prevent, and a test that reached in and set a flag would prove the flag rather than the guard.
 * Skipped per engine without a checkout, like every other live suite here.
 */
for (const [engine, spec] of Object.entries(RENDER_ENGINES)) {
  const configured = process.env[spec.rootVar] ?? "";
  describe.skipIf(configured === "")(`one render at a time: ${engine}`, () => {
    it("refuses a second press while the first is still running, and frees up after", async () => {
      const body = { engine, text: "{{char}} waits" };
      const [first, second] = await Promise.all([
        handleMacroLabRoutes("/api/macro-lab/resolve", post(body)),
        // Started in the same tick, so it lands while the first render still owns the engine.
        handleMacroLabRoutes("/api/macro-lab/resolve", post(body)),
      ]);

      const codes = [first!.status, second!.status].sort();
      expect(codes).toEqual([200, 429]);

      const refused = first!.status === 429 ? first! : second!;
      const why = (await refused.json()) as { error: string };
      // Named, because "try again" without saying what is busy is not actionable.
      expect(why.error).toContain(spec.label);

      // And the engine is released rather than stuck: the guard must not outlive the render.
      const after = await handleMacroLabRoutes("/api/macro-lab/resolve", post(body));
      expect(after!.status).toBe(200);
    }, 180_000);
  });
}
