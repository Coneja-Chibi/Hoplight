/**
 * The staged-commit door: stageArchiveEntities + handleSaveStaged, tested against the handlers
 * directly (same style as server-inspect-archive.test.ts). Proves the full by-reference loop -
 * inspect stages entities on disk, save-staged commits them through the real saveBundle into a
 * real StudioStore - plus the refIds rewrite semantics and every refusal the endpoint owes.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFormats } from "../core";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import { buildMinimalLvbak } from "../formats/_fixtures/lumiverse-archive/build-lvbak";
import { StudioStore } from "../studio/store";
import type { InspectArchiveResult, SaveBundleResult } from "./app-contract";
import { handleInspectArchive } from "./server-engine";
import { clearAllStagings, handleSaveStaged, stageArchiveEntities } from "./server-staging";

const dirs: string[] = [];
async function freshStore(): Promise<StudioStore> {
  const dir = await mkdtemp(join(tmpdir(), "hoplight-staging-test-"));
  dirs.push(dir);
  return new StudioStore(dir);
}

beforeAll(async () => {
  await loadFormats();
});

afterAll(async () => {
  await clearAllStagings();
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const inspectReq = (body: Uint8Array): Request =>
  new Request("http://127.0.0.1:8321/api/inspect-archive", {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "x-filename": "backup.lvbak" },
    body: body as unknown as BodyInit,
  });

const saveReq = (body: unknown, contentType = "application/json"): Request =>
  new Request("http://127.0.0.1:8321/api/studio/save-staged", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });

/** A minimal valid canonical persona carrying knowledgeRefs, for rewrite-semantics tests. */
const personaWithRefs = (id: string, refs: string[]): ParsedCanonicalEntity =>
  ({
    schemaVersion: "1",
    kind: "persona",
    id,
    body: { name: `P-${id}`, content: "Test persona.", knowledgeRefs: refs },
    original: { "lumiverse-archive": { raw: { sealed: true }, unmapped: {} } },
  }) as unknown as ParsedCanonicalEntity;

describe("the full by-reference loop", () => {
  test("every row an inspect stages commits through save-staged into a real store", async () => {
    const store = await freshStore();
    const res = await handleInspectArchive(inspectReq(buildMinimalLvbak()));
    const body = (await res.json()) as InspectArchiveResult;
    expect(body.ok).toBe(true);
    for (const row of body.rows!) {
      const saved = await handleSaveStaged(saveReq({ token: row.staged!.token, key: row.staged!.key }), store);
      expect(saved.status).toBe(200);
      const outcome = (await saved.json()) as SaveBundleResult;
      expect(outcome.ok).toBe(true);
      expect(outcome.primary?.id).toBeTruthy();
    }
    const shelved = await store.list();
    expect(shelved.length).toBe(body.rows!.length);
  });
});

describe("refIds rewrite semantics (the server side of deck-core's case 3a/3b)", () => {
  test("a mapped ref rewrites to the REAL id; present-but-empty refIds DROPS refs; absent refIds leaves them alone", async () => {
    const store = await freshStore();
    const refs = await stageArchiveEntities([
      personaWithRefs("pa", ["old-book"]),
      personaWithRefs("pb", ["old-book"]),
      personaWithRefs("pc", ["old-book"]),
    ]);

    const mapped = await handleSaveStaged(
      saveReq({ token: refs[0]!.token, key: refs[0]!.key, refIds: { "old-book": "real-book" } }),
      store,
    );
    expect(mapped.status).toBe(200);
    const dropped = await handleSaveStaged(saveReq({ token: refs[1]!.token, key: refs[1]!.key, refIds: {} }), store);
    expect(dropped.status).toBe(200);
    const untouched = await handleSaveStaged(saveReq({ token: refs[2]!.token, key: refs[2]!.key }), store);
    expect(untouched.status).toBe(200);

    const bodyOf = async (id: string): Promise<{ knowledgeRefs?: string[] }> =>
      (await store.read("persona", id))!.body as { knowledgeRefs?: string[] };
    expect((await bodyOf("pa")).knowledgeRefs).toEqual(["real-book"]);
    expect((await bodyOf("pb")).knowledgeRefs).toBeUndefined();
    expect((await bodyOf("pc")).knowledgeRefs).toEqual(["old-book"]);
  });
});

describe("multi-archive drops (one drop can carry several .lvbak files)", () => {
  test("staging a second archive leaves the FIRST archive's rows committable", async () => {
    const store = await freshStore();
    const first = await stageArchiveEntities([personaWithRefs("multi-a", [])]);
    const second = await stageArchiveEntities([personaWithRefs("multi-b", [])]);
    expect(first[0]!.token).not.toBe(second[0]!.token);
    const savedFirst = await handleSaveStaged(saveReq({ token: first[0]!.token, key: first[0]!.key }), store);
    expect(savedFirst.status).toBe(200);
    const savedSecond = await handleSaveStaged(saveReq({ token: second[0]!.token, key: second[0]!.key }), store);
    expect(savedSecond.status).toBe(200);
    const shelved = await store.list();
    expect(shelved.map((e) => e.id).sort()).toEqual(["multi-a", "multi-b"]);
  });

  test("the staging map is bounded: past MAX_STAGINGS the oldest goes stale, the rest stay live", async () => {
    const store = await freshStore();
    const oldest = await stageArchiveEntities([personaWithRefs("evict-me", [])]);
    const rest: Awaited<ReturnType<typeof stageArchiveEntities>>[] = [];
    for (let i = 0; i < 8; i += 1) rest.push(await stageArchiveEntities([personaWithRefs(`keep-${i}`, [])]));
    const evicted = await handleSaveStaged(saveReq({ token: oldest[0]!.token, key: oldest[0]!.key }), store);
    expect(evicted.status).toBe(409);
    const newest = rest[rest.length - 1]!;
    expect((await handleSaveStaged(saveReq({ token: newest[0]!.token, key: newest[0]!.key }), store)).status).toBe(200);
  });
});

describe("refusals", () => {
  test("a bogus token is a 409 with warm words", async () => {
    const store = await freshStore();
    await stageArchiveEntities([personaWithRefs("p-live", [])]);
    const res = await handleSaveStaged(saveReq({ token: "not-a-real-token", key: "row-0" }), store);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("no longer staged");
  });

  test("an unknown key on a live token is a 404", async () => {
    const store = await freshStore();
    const refs = await stageArchiveEntities([personaWithRefs("p1", [])]);
    const res = await handleSaveStaged(saveReq({ token: refs[0]!.token, key: "row-999" }), store);
    expect(res.status).toBe(404);
  });

  test("nothing staged at all is a 409", async () => {
    const store = await freshStore();
    await clearAllStagings();
    const res = await handleSaveStaged(saveReq({ token: "t", key: "row-0" }), store);
    expect(res.status).toBe(409);
  });

  test("a malformed body is a 400 and the wrong content-type a 415", async () => {
    const store = await freshStore();
    expect((await handleSaveStaged(saveReq({ token: 7 }), store)).status).toBe(400);
    expect((await handleSaveStaged(saveReq({}, "text/plain"), store)).status).toBe(415);
  });
});
