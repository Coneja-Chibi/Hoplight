/**
 * The collections boundary: what a request may turn into.
 *
 * This is the one place an outside body becomes an edit to a file in somebody's studio folder, so
 * the tests worth having are the refusals. Everything past this point trusts the parsed edit.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleCollectionsRoutes, parseEdit } from "./server-collections";
import { applyCollectionEdit, EMPTY_COLLECTIONS } from "../studio/collections-shape";

describe("parseEdit", () => {
  test("the five edits it accepts", () => {
    expect(parseEdit({ action: "create", name: "Cast" })).toEqual({
      ok: true, edit: { action: "create", name: "Cast" },
    });
    expect(parseEdit({ action: "rename", id: "cast", name: "Act II" }).ok).toBe(true);
    expect(parseEdit({ action: "delete", id: "cast" }).ok).toBe(true);
    expect(parseEdit({ action: "add", id: "cast", ref: { kind: "character", id: "b" } }).ok).toBe(true);
    expect(parseEdit({ action: "remove", id: "cast", ref: { kind: "character", id: "b" } }).ok).toBe(true);
  });

  test("AN UNKNOWN ACTION IS NOT AN EDIT", () => {
    // The default case is a refusal, not a fall-through to something plausible.
    expect(parseEdit({ action: "drop-everything", id: "cast" }).ok).toBe(false);
    expect(parseEdit({ id: "cast" }).ok).toBe(false);
    expect(parseEdit(null).ok).toBe(false);
    expect(parseEdit("create").ok).toBe(false);
  });

  test("every edit that names a collection must actually name one", () => {
    expect(parseEdit({ action: "rename", name: "x" }).ok).toBe(false);
    expect(parseEdit({ action: "delete", id: "" }).ok).toBe(false);
    expect(parseEdit({ action: "create", name: "" }).ok).toBe(false);
  });

  test("A MALFORMED REF NEVER BECOMES A MEMBERSHIP", () => {
    /**
     * A ref missing a kind would store `{id}` alone, and resolving it later would match nothing -
     * a member that exists on disk and can never be shown or removed.
     */
    expect(parseEdit({ action: "add", id: "c", ref: { id: "b" } }).ok).toBe(false);
    expect(parseEdit({ action: "add", id: "c", ref: { kind: "character" } }).ok).toBe(false);
    expect(parseEdit({ action: "add", id: "c", ref: "character:b" }).ok).toBe(false);
    expect(parseEdit({ action: "add", id: "c" }).ok).toBe(false);
  });

  test("NAMES AND NOTES ARE BOUNDED", () => {
    /**
     * The file is read on every listing. An unbounded name is a way to push megabytes into it and
     * make the library slow to open, from a route that otherwise looks harmless.
     */
    expect(parseEdit({ action: "create", name: "x".repeat(121) }).ok).toBe(false);
    expect(parseEdit({ action: "create", name: "ok", note: "x".repeat(501) }).ok).toBe(false);
    expect(parseEdit({ action: "create", name: "x".repeat(120) }).ok).toBe(true);
  });
});

describe("applyCollectionEdit", () => {
  test("create then add then remove, through the pure core", () => {
    const made = applyCollectionEdit(EMPTY_COLLECTIONS, { action: "create", name: "Cast" });
    const id = made.collections[0]!.id;
    const ref = { kind: "character", id: "basil-1" };
    const held = applyCollectionEdit(made, { action: "add", id, ref });
    expect(held.collections[0]?.members).toHaveLength(1);
    expect(applyCollectionEdit(held, { action: "remove", id, ref }).collections[0]?.members)
      .toHaveLength(0);
  });
});

describe("the route", () => {
  let dir = "";
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "hl-collections-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  const call = (init?: RequestInit) =>
    handleCollectionsRoutes(
      "/api/collections",
      new Request("http://127.0.0.1/api/collections", init),
      () => dir,
    );

  const post = (body: unknown) => call({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  test("ANYTHING THAT IS NOT OURS IS NOT OURS", async () => {
    // The table keeps its shape only if this returns null rather than a 404 of its own.
    expect(await handleCollectionsRoutes("/api/settings", new Request("http://x/"), () => dir)).toBeNull();
    expect(await handleCollectionsRoutes("/api/collections/x", new Request("http://x/"), () => dir)).toBeNull();
  });

  test("a fresh studio reads as no collections", async () => {
    const res = await call();
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({ collections: [] });
  });

  test("a create round-trips to disk", async () => {
    const made = await post({ action: "create", name: "The Cast" });
    expect(made?.status).toBe(200);
    const body = await made!.json() as { collections: { id: string; name: string }[] };
    expect(body.collections[0]?.name).toBe("The Cast");
    expect(body.collections[0]?.id).toBe("the-cast");
    // Read back through a second store: the write actually landed, not just in memory.
    expect(await (await call())!.json()).toEqual(body);
  });

  test("a bad edit is a 400 and CHANGES NOTHING", async () => {
    await post({ action: "create", name: "Cast" });
    const bad = await post({ action: "nonsense" });
    expect(bad?.status).toBe(400);
    const after = await (await call())!.json() as { collections: unknown[] };
    expect(after.collections).toHaveLength(1);
  });

  test("PUT AND DELETE ARE NOT DOORS", async () => {
    // Only GET reads and POST edits. Anything else is a method that was never designed for.
    expect((await call({ method: "PUT" }))?.status).toBe(405);
    expect((await call({ method: "DELETE" }))?.status).toBe(405);
  });

  test("a POST that is not JSON is refused before it is read", async () => {
    const res = await call({ method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    expect(res?.status).toBe(415);
  });
});
