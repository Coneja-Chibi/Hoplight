/**
 * The Macro Lab route's boundary: what it accepts from a browser before handing a subprocess a file.
 *
 * The bounds are the whole of what stops this being an open pipe into someone else's application, so
 * they are asserted rather than assumed. The engine-absent case matters just as much: an absent
 * engine that answered 200 with nothing unresolved would read on screen as "your macros are fine",
 * which is the one answer this surface must never invent.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyEngineRoots, RENDER_ENGINES } from "../core/preset/render/engines";
import { readEngineRoots } from "../studio/engine-roots";
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
 * A studio folder per test. The routes read engines.json out of it, so a shared one would let a
 * saved root from one case decide another case's answer.
 */
let studioDir = "";

/** A folder that passes the marker check without being a working engine - nothing is spawned here. */
async function fakeCheckout(name: string, engine: keyof typeof RENDER_ENGINES): Promise<string> {
  const root = join(studioDir, name);
  const marker = join(root, RENDER_ENGINES[engine].marker);
  await mkdir(dirname(marker), { recursive: true });
  await writeFile(marker, "// enough to be recognised, not enough to run\n");
  return root;
}

const roots = (method: "GET" | "POST", body?: unknown): Request =>
  new Request("http://127.0.0.1/api/macro-lab/roots", {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });

interface RootRow {
  id: string;
  label: string;
  rootVar: string;
  saved: string;
  env: string;
  root: string;
  from: "env" | "saved" | null;
}

const rowsOf = async (res: Response | null): Promise<RootRow[]> =>
  ((await res!.json()) as { engines: RootRow[] }).engines;

const rowFor = async (res: Response | null, id: string): Promise<RootRow> =>
  (await rowsOf(res)).find((r) => r.id === id)!;

/**
 * The engine roots are read from the process environment, so a test that clears them must put back
 * exactly what it found - including "it was not set at all", which is not the same as "". A suite
 * that leaks HOPLIGHT_ST_ROOT="" would silently retire the live render tests for everything after it.
 */
const ENV_KEYS = Object.values(RENDER_ENGINES).map((e) => e.rootVar);
let saved: Record<string, string | undefined> = {};

beforeEach(async () => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  clearRunningEngines();
  studioDir = await mkdtemp(join(tmpdir(), "hoplight-engines-"));
});

afterEach(async () => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  // Saving a root hands it to core as well as to disk, and core's copy is process-wide. A leak
  // here would let one case's fake checkout answer another case's "no engine on this machine".
  applyEngineRoots({});
  await rm(studioDir, { recursive: true, force: true });
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
      studioDir,
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
      studioDir,
    );
    expect(res).not.toBeNull();
    expect(await res!.json()).toEqual({ engines: [] });
  });

  it("refuses a body that is not json", async () => {
    const res = await handleMacroLabRoutes(
      "/api/macro-lab/resolve",
      new Request("http://127.0.0.1/api/macro-lab/resolve", { method: "POST", body: "x" }),
      studioDir,
    );
    expect(res!.status).toBe(415);
  });

  it("returns null for a path that is not ours, so the caller's table keeps its shape", async () => {
    const res = await handleMacroLabRoutes(
      "/api/formats",
      new Request("http://127.0.0.1/api/formats"),
      studioDir,
    );
    expect(res).toBeNull();
  });

  it("does not answer a GET-only route to a POST, or the reverse", async () => {
    const asPost = await handleMacroLabRoutes(
      "/api/macro-lab/engines",
      new Request("http://127.0.0.1/api/macro-lab/engines", { method: "POST" }),
      studioDir,
    );
    expect(asPost).toBeNull();
    const asGet = await handleMacroLabRoutes(
      "/api/macro-lab/resolve",
      new Request("http://127.0.0.1/api/macro-lab/resolve"),
      studioDir,
    );
    expect(asGet).toBeNull();
  });
});

/**
 * POINTING AN ENGINE AT A FOLDER - the thing Settings does.
 *
 * The path is what a person types, so it is checked BEFORE it is stored: a folder that is not a
 * checkout would otherwise sit in the file looking configured until a render failed somewhere deep
 * in a subprocess's stderr. None of these spawn anything; a marker file is all it takes to be
 * recognised, and recognition is what is under test.
 */
describe("the engine-roots surface", () => {
  it("lists every engine there could be, not only the ones that are here", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const rows = await rowsOf(await handleMacroLabRoutes("/api/macro-lab/roots", roots("GET"), studioDir));
    // The Macro Lab's own list is "what can run"; this one is "what you could point at", or the
    // screen for fixing an absent engine would have nothing on it.
    expect(rows.map((r) => r.id).sort()).toEqual(Object.keys(RENDER_ENGINES).sort());
    expect(rows.every((r) => r.saved === "" && r.root === "" && r.from === null)).toBe(true);
  });

  it("refuses a folder that is not a checkout, names the file it wanted, and stores nothing", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const notIt = join(studioDir, "downloads");
    await mkdir(notIt, { recursive: true });

    const res = await handleMacroLabRoutes(
      "/api/macro-lab/roots",
      roots("POST", { engine: "sillytavern", root: notIt }),
      studioDir,
    );
    expect(res!.status).toBe(422);
    const body = (await res!.json()) as { error: string };
    expect(body.error).toContain(RENDER_ENGINES.sillytavern.marker);
    // Nothing written: a refused save that still recorded the path would make the next boot believe it.
    expect(await readEngineRoots(studioDir)).toEqual({});
  });

  it("accepts a real checkout, and the Macro Lab can then see the engine", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const root = await fakeCheckout("SillyTavern", "sillytavern");

    const row = await rowFor(
      await handleMacroLabRoutes(
        "/api/macro-lab/roots",
        roots("POST", { engine: "sillytavern", root }),
        studioDir,
      ),
      "sillytavern",
    );
    expect(row.saved).toBe(root);
    expect(row.from).toBe("saved");

    // The claim this whole change exists for: the room that said "no engine" now has one.
    const listed = await handleMacroLabRoutes(
      "/api/macro-lab/engines",
      new Request("http://127.0.0.1/api/macro-lab/engines"),
      studioDir,
    );
    expect((await listed!.json()) as unknown).toEqual({ engines: [{ id: "sillytavern", label: "SillyTavern" }] });
  });

  it("takes the path Windows puts on the clipboard, quotes and trailing slash and all", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const root = await fakeCheckout("ST-quoted", "sillytavern");

    const row = await rowFor(
      await handleMacroLabRoutes(
        "/api/macro-lab/roots",
        // Explorer's "Copy as path" yields the quotation marks; a paste that failed over them would
        // blame the user for the clipboard.
        roots("POST", { engine: "sillytavern", root: `  "${root}\\"  ` }),
        studioDir,
      ),
      "sillytavern",
    );
    expect(row.saved).toBe(root);
    expect(row.from).toBe("saved");
  });

  it("lets the variable win, and says so, when a process was launched with one", async () => {
    const savedRoot = await fakeCheckout("saved-st", "sillytavern");
    const envRoot = await fakeCheckout("env-st", "sillytavern");
    await handleMacroLabRoutes(
      "/api/macro-lab/roots",
      roots("POST", { engine: "sillytavern", root: savedRoot }),
      studioDir,
    );

    process.env[RENDER_ENGINES.sillytavern.rootVar] = envRoot;
    const row = await rowFor(
      await handleMacroLabRoutes("/api/macro-lab/roots", roots("GET"), studioDir),
      "sillytavern",
    );
    // The live render suites all point the variables at a checkout of their choosing; a saved
    // setting that outranked them would silently redirect a harness that named its own engine.
    expect(row.root).toBe(envRoot);
    expect(row.from).toBe("env");
    expect(row.saved).toBe(savedRoot);
  });

  it("keeps saying the folder is saved after the checkout moves away, and stops offering it", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const root = await fakeCheckout("gone-st", "sillytavern");
    await handleMacroLabRoutes(
      "/api/macro-lab/roots",
      roots("POST", { engine: "sillytavern", root }),
      studioDir,
    );
    await rm(root, { recursive: true, force: true });

    const row = await rowFor(
      await handleMacroLabRoutes("/api/macro-lab/roots", roots("GET"), studioDir),
      "sillytavern",
    );
    // Both halves matter: the path stays visible because it is the fault, and the engine stops
    // being offered because it cannot answer.
    expect(row.saved).toBe(root);
    expect(row.from).toBeNull();
    const listed = await handleMacroLabRoutes(
      "/api/macro-lab/engines",
      new Request("http://127.0.0.1/api/macro-lab/engines"),
      studioDir,
    );
    expect((await listed!.json()) as unknown).toEqual({ engines: [] });
  });

  it("clears a folder on an empty path rather than calling it a bad one", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const root = await fakeCheckout("bye-st", "sillytavern");
    await handleMacroLabRoutes(
      "/api/macro-lab/roots",
      roots("POST", { engine: "sillytavern", root }),
      studioDir,
    );

    const res = await handleMacroLabRoutes(
      "/api/macro-lab/roots",
      roots("POST", { engine: "sillytavern", root: "   " }),
      studioDir,
    );
    expect(res!.status).toBe(200);
    expect(await readEngineRoots(studioDir)).toEqual({});
  });

  it("refuses an engine it does not run and a root that is not a string", async () => {
    for (const body of [
      { engine: "rolecall", root: "C:\\wherever" },
      { engine: "sillytavern", root: 7 },
      { engine: "sillytavern" },
    ]) {
      const res = await handleMacroLabRoutes("/api/macro-lab/roots", roots("POST", body), studioDir);
      expect(res!.status).toBe(400);
    }
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
        handleMacroLabRoutes("/api/macro-lab/resolve", post(body), studioDir),
        // Started in the same tick, so it lands while the first render still owns the engine.
        handleMacroLabRoutes("/api/macro-lab/resolve", post(body), studioDir),
      ]);

      const codes = [first!.status, second!.status].sort();
      expect(codes).toEqual([200, 429]);

      const refused = first!.status === 429 ? first! : second!;
      const why = (await refused.json()) as { error: string };
      // Named, because "try again" without saying what is busy is not actionable.
      expect(why.error).toContain(spec.label);

      // And the engine is released rather than stuck: the guard must not outlive the render.
      const after = await handleMacroLabRoutes("/api/macro-lab/resolve", post(body), studioDir);
      expect(after!.status).toBe(200);
    }, 180_000);
  });
}
