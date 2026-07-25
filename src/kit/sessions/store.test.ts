/**
 * Store edge round-trip against a throwaway HOPLIGHT_HOME, mirroring vault.test.ts: write/read is
 * byte-faithful, the list tolerates a corrupt file, remove is idempotent, export lands where it says,
 * and the parse boundary denies a malformed session whole rather than silently dropping wire history.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "../providers/provider";
import { appendTurn, buildTurn, emptySession, renameSession, type Session } from "./session-model";
import { createSessionStore, parseSession, sessionsDir, type SessionStore } from "./store";

const HOME = join(tmpdir(), `kit-sessions-test-${randomUUID()}`);
// Built in beforeAll, AFTER HOPLIGHT_HOME is set, so the default dir resolves to the temp home.
let store: SessionStore;

const msg = (content: string, role: ModelMessage["role"] = "user"): ModelMessage => ({ role, content });

const sample = (id: string, updatedAt: number): Session => {
  let s = emptySession(id, updatedAt - 100);
  s = appendTurn(s, buildTurn("hello there", [msg("hello there"), msg("hi", "assistant")], updatedAt));
  return renameSession(s, "a saved session", updatedAt);
};

beforeAll(() => {
  process.env.HOPLIGHT_HOME = HOME;
  store = createSessionStore();
});

afterAll(async () => {
  delete process.env.HOPLIGHT_HOME;
  await rm(HOME, { recursive: true, force: true });
});

describe("session store", () => {
  test("no sessions dir yet lists empty", async () => {
    expect(await store.list()).toEqual([]);
  });

  test("write then read returns the exact session", async () => {
    const session = sample("alpha", 3000);
    await store.write(session);
    expect(await store.read("alpha")).toEqual(session);
  });

  test("read of a missing or unsafe id is null, never a throw", async () => {
    expect(await store.read("ghost")).toBeNull();
    expect(await store.read("../escape")).toBeNull();
  });

  test("list summarizes and sorts newest-first, skipping a corrupt file", async () => {
    await store.write(sample("beta", 5000));
    await store.write(sample("gamma", 1000));
    await mkdir(sessionsDir(), { recursive: true });
    await writeFile(join(sessionsDir(), "broken.json"), "{ not json", "utf8");

    const summaries = await store.list();
    const ids = summaries.map((s) => s.id);
    expect(ids).toContain("beta");
    expect(ids).toContain("gamma");
    expect(ids).not.toContain("broken");
    // beta (5000) is newer than alpha (3000) is newer than gamma (1000).
    expect(ids.indexOf("beta")).toBeLessThan(ids.indexOf("alpha"));
    expect(ids.indexOf("alpha")).toBeLessThan(ids.indexOf("gamma"));
  });

  test("remove is idempotent: true when a file goes, false when already gone", async () => {
    await store.write(sample("delta", 2000));
    expect(await store.remove("delta")).toBe(true);
    expect(await store.remove("delta")).toBe(false);
    expect(await store.read("delta")).toBeNull();
  });

  test("writeExport lands the body under the export dir and returns the path", async () => {
    const exportDir = join(HOME, "exports");
    const path = await store.writeExport(exportDir, "a-transcript.md", "# hi\n");
    expect(path).toBe(join(exportDir, "a-transcript.md"));
    expect(await readFile(path, "utf8")).toBe("# hi\n");
  });

  test("writeExport strips any path parts from the filename", async () => {
    const exportDir = join(HOME, "exports");
    const path = await store.writeExport(exportDir, "../../evil.md", "x");
    expect(path).toBe(join(exportDir, "evil.md"));
  });
});

describe("parseSession boundary", () => {
  test("a good record parses", () => {
    expect(parseSession(sample("ok", 10))).not.toBeNull();
  });

  test("missing version is denied", () => {
    const { version, ...rest } = sample("v", 10);
    expect(parseSession(rest)).toBeNull();
  });

  test("a malformed message denies the whole session (no silent drop)", () => {
    const bad = {
      ...sample("m", 10),
      turns: [{ input: "x", at: 10, messages: [{ role: "user" }] }], // content missing
    };
    expect(parseSession(bad)).toBeNull();
  });

  test("a bad parent shape is denied, but a null parent is fine", () => {
    expect(parseSession({ ...sample("p", 10), parent: { id: "x" } })).toBeNull();
    expect(parseSession({ ...sample("p", 10), parent: null })).not.toBeNull();
  });
});
