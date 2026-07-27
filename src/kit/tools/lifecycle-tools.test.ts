/**
 * Coverage for the lifecycle tools beyond creation: delete, duplicate, and transfer. The negative
 * behavior is the point here - no write on a miss, escrow carried on a copy, no file written by a
 * transfer, and a macro report that refuses to look clean when it did not actually check.
 */
import { describe, expect, test } from "bun:test";
import { createChangeSession } from "../changes/session";
import type { KitBridge, KitEntity } from "../bridge";
import type { ToolContext } from "./tool";
import { resolveAccess } from "./safety/access";
import { classifyRisk } from "./safety/risk";
import remove from "./delete";
import duplicate from "./duplicate";
import transfer from "./transfer";

/** A complete character body: the runtime schema is strict, and a copy must survive re-parsing. */
const characterBody = (name: string): unknown => ({
  identity: { name },
  persona: {},
  prompts: {},
  greetings: {},
  examples: {},
  media: {},
  attribution: {},
  discovery: {},
});

const NYX = {
  schemaVersion: 1,
  id: "nyx",
  kind: "character",
  body: characterBody("Nyx"),
  profiles: { sillytavern: { discovery: { tags: ["kept"] } } },
  original: { sillytavern: { raw: { name: "Nyx" }, unmapped: { fav_color: "black" } } },
} as unknown as KitEntity;

const BOOK = {
  schemaVersion: 1,
  id: "world",
  kind: "lorebook",
  body: { name: "World Bible", entries: [] },
} as unknown as KitEntity;

interface Recorder {
  deleted: string[];
  saved: unknown[];
}

const makeBridge = (rec: Recorder, pieces: Record<string, KitEntity> = {}): KitBridge => ({
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind: string, id: string) { return pieces[`${kind}/${id}`] ?? null; },
  async save(raw: unknown) {
    rec.saved.push(raw);
    throw new Error("lifecycle previews must not write");
  },
  async delete(kind: string, id: string) {
    rec.deleted.push(`${kind}/${id}`);
    return `${kind}/${id}` in pieces;
  },
});

describe("studio_delete", () => {
  test("is classified at the danger floor, not as an ordinary write", () => {
    const access = resolveAccess("studio_delete");
    expect(access).toBe("delete");
    expect(classifyRisk(access, undefined, "studio_delete").level).toBe("danger");
  });

  test("carries no discovery metadata, so only the safety map can classify it", () => {
    expect(remove.effect).toBe("apply");
    expect(remove.discovery).toBeUndefined();
  });

  test("a miss removes nothing and reports stale", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await remove.execute(
      { kind: "character", id: "ghost" },
      { bridge: makeBridge(rec) },
    );
    expect(result.outcome).toBe("stale");
    expect(rec.deleted).toEqual([]);
    expect(result.output).toContain("Nothing was removed");
  });

  test("a hit removes exactly one piece and says it cannot be undone", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await remove.execute(
      { kind: "character", id: "nyx" },
      { bridge: makeBridge(rec, { "character/nyx": NYX }) },
    );
    expect(result.outcome).toBe("applied");
    expect(rec.deleted).toEqual(["character/nyx"]);
    expect(result.output).toContain("cannot be undone");
  });

  test("removing a referenceable kind warns that references were not checked", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await remove.execute(
      { kind: "lorebook", id: "world" },
      { bridge: makeBridge(rec, { "lorebook/world": BOOK }) },
    );
    expect(result.output).toContain("dangling reference");
    expect(result.output).toContain("not checked");
  });
});

describe("studio_duplicate", () => {
  const ctx = (rec: Recorder): ToolContext => ({
    bridge: makeBridge(rec, { "character/nyx": NYX }),
    changes: createChangeSession(),
  });

  test("previews without writing", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await duplicate.execute({ kind: "character", id: "nyx" }, ctx(rec));
    expect(result.outcome).toBe("draft");
    expect(rec.saved).toEqual([]);
    expect(rec.deleted).toEqual([]);
  });

  test("carries escrow and profiles onto the copy", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const session = createChangeSession();
    const result = await duplicate.execute(
      { kind: "character", id: "nyx", newId: "nyx-two" },
      { bridge: makeBridge(rec, { "character/nyx": NYX }), changes: session },
    );
    const draft = session.list()[0];
    expect(draft).toBeDefined();
    const proposed = session.get(draft!.id)?.proposed as unknown as {
      id: string;
      original?: Record<string, { unmapped?: Record<string, unknown> }>;
      profiles?: Record<string, unknown>;
    };
    expect(proposed.id).toBe("nyx-two");
    expect(proposed.original?.sillytavern?.unmapped?.fav_color).toBe("black");
    expect(proposed.profiles?.sillytavern).toEqual({ discovery: { tags: ["kept"] } });
    expect(result.review?.changes[0]?.after).toMatchObject({ escrowCarried: true });
  });

  test("renames the copy in the body, not just the id", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const session = createChangeSession();
    await duplicate.execute(
      { kind: "character", id: "nyx", newId: "nyx-two", name: "Nyx Prime" },
      { bridge: makeBridge(rec, { "character/nyx": NYX }), changes: session },
    );
    const draft = session.list()[0];
    const proposed = session.get(draft!.id)?.proposed as unknown as {
      body: { identity: { name: string } };
    };
    expect(proposed.body.identity.name).toBe("Nyx Prime");
  });

  test("a missing source copies nothing", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await duplicate.execute({ kind: "character", id: "ghost" }, ctx(rec));
    expect(result.outcome).toBe("stale");
    expect(rec.saved).toEqual([]);
  });
});

describe("studio_transfer", () => {
  test("is a read: it touches no storage and writes no file", () => {
    expect(resolveAccess("studio_transfer")).toBe("read");
    expect(transfer.effect).toBe("read");
  });

  test("refuses a target that writes a different entity kind", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await transfer.execute(
      { kind: "character", id: "nyx", to: "sillytavern-preset" },
      { bridge: makeBridge(rec, { "character/nyx": NYX }) },
    );
    expect(result.output).toContain("cannot carry a character");
    expect(rec.saved).toEqual([]);
  });

  test("names the real targets when the adapter id is unknown", async () => {
    const rec: Recorder = { deleted: [], saved: [] };
    const result = await transfer.execute(
      { kind: "character", id: "nyx", to: "not-a-real-format" },
      { bridge: makeBridge(rec, { "character/nyx": NYX }) },
    );
    expect(result.summary).toContain("unknown target");
    expect(result.output).toContain("sillytavern");
  });
});
