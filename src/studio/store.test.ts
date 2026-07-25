/**
 * StudioStore path containment + validation (temp roots only).
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { StudioValidationError } from "./errors";
import { StudioStore } from "./store";
import { entityRevision } from "../kit/changes/revision";

const ent = (id: string, kind = "character") => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind,
  id,
  body: {
    identity: { name: id },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  },
});

describe("StudioStore containment", () => {
  let root: string;
  let store: StudioStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vaude-store-"));
    store = new StudioStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("save + read + list happy path", async () => {
    const s = await store.save(ent("vera"));
    expect(s.id).toBe("vera");
    const got = await store.read("character", "vera");
    expect(got?.id).toBe("vera");
    const list = await store.list("character");
    expect(list.some((e) => e.id === "vera")).toBe(true);
  });

  test("rejects path traversal kind/id without writing outside", async () => {
    const sentinel = join(root, "..", "vaude-sentinel-outside.txt");
    // place sentinel outside store root sibling
    const outside = join(tmpdir(), `vaude-outside-${Date.now()}.txt`);
    await writeFile(outside, "safe");
    await expect(store.save({ ...ent("x"), kind: "../etc" })).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    await expect(store.read("character", "../escape")).rejects.toBeInstanceOf(StudioValidationError);
    await expect(store.list("../../../tmp")).rejects.toBeInstanceOf(StudioValidationError);
    const still = await Bun.file(outside).text();
    expect(still).toBe("safe");
    await rm(outside, { force: true });
    void sentinel;
  });

  test("keep-both mints sibling id", async () => {
    await store.save(ent("twin"));
    const s2 = await store.save(ent("twin"));
    expect(s2.id).toBe("twin-2");
  });

  test("delete removes the file, reports absence honestly, refuses traversal", async () => {
    await store.save(ent("gone"));
    expect(await store.delete("character", "gone")).toBe(true);
    expect(await store.read("character", "gone")).toBeNull();
    // deleting what is not there is false, never a throw (idempotent from the UI's view)
    expect(await store.delete("character", "gone")).toBe(false);
    await expect(store.delete("character", "../escape")).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    await expect(store.delete("../etc", "x")).rejects.toBeInstanceOf(StudioValidationError);
  });

  test("path/kind mismatch throws read error", async () => {
    await mkdir(join(root, "character"), { recursive: true });
    await writeFile(
      join(root, "character", "bad.json"),
      JSON.stringify({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: "bad",
        body: {},
      }),
    );
    await expect(store.read("character", "bad")).rejects.toThrow();
  });

  test("rejects an entity whose schemaVersion read() would refuse (no invisible files)", async () => {
    // Without this gate, save() writes a file that read()/list() then treat as corrupt forever:
    // the piece exists on disk but never appears in the studio again.
    const { schemaVersion: _v, ...bare } = ent("ghost");
    await expect(store.save(bare as never)).rejects.toBeInstanceOf(StudioValidationError);
    await expect(store.save({ ...ent("ghost"), schemaVersion: "0" } as never)).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    const list = await store.list("character");
    expect(list.some((e) => e.id === "ghost")).toBe(false);
  });

  test("rejects malformed nested canonical data before writing", async () => {
    const malformed = {
      ...ent("wrong-shape"),
      body: { ...ent("wrong-shape").body, identity: { name: 42 } },
    };
    await expect(store.save(malformed)).rejects.toBeInstanceOf(StudioValidationError);
    expect(await store.read("character", "wrong-shape")).toBeNull();
  });

  test("overwrite preserves importedAt", async () => {
    const s1 = await store.save(ent("keep"));
    const first = s1.importedAt;
    expect(first).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));
    const s2 = await store.save(ent("keep"), { overwrite: true });
    expect(s2.importedAt).toBe(first);
    const disk = await store.read("character", "keep");
    const um = disk?.original?.["vaud-studio"]?.unmapped;
    expect(um?.["importedAt"]).toBe(first);
  });

  test("compareAndSave writes once for the expected revision and rejects a stale retry", async () => {
    await store.save(ent("revision"));
    const baseline = (await store.read("character", "revision"))!;
    const expectedRevision = entityRevision(baseline);
    const baselineBody = baseline.body as ReturnType<typeof ent>["body"];
    const changed = {
      ...baseline,
      body: {
        ...baselineBody,
        identity: { ...baselineBody.identity, name: "new" },
      },
    };

    const saved = await store.compareAndSave(changed, expectedRevision);
    expect(saved.status).toBe("saved");
    expect(((await store.read("character", "revision"))!.body as { identity: { name: string } })
      .identity.name).toBe("new");

    const stale = await store.compareAndSave({
      ...changed,
      body: {
        ...changed.body,
        identity: { ...(changed.body as { identity: object }).identity, name: "stale overwrite" },
      },
    }, expectedRevision);
    expect(stale.status).toBe("stale");
    expect(((await store.read("character", "revision"))!.body as { identity: { name: string } })
      .identity.name).toBe("new");
  });

  test("two concurrent compareAndSave calls from one revision have exactly one winner", async () => {
    await store.save(ent("race"));
    const baseline = (await store.read("character", "race"))!;
    const expectedRevision = entityRevision(baseline);
    const body = baseline.body as ReturnType<typeof ent>["body"];
    const result = await Promise.all([
      store.compareAndSave({
        ...baseline,
        body: { ...body, identity: { ...body.identity, name: "first" } },
      }, expectedRevision),
      store.compareAndSave({
        ...baseline,
        body: { ...body, identity: { ...body.identity, name: "second" } },
      }, expectedRevision),
    ]);
    expect(result.map((item) => item.status).sort()).toEqual(["saved", "stale"]);
  });
});
