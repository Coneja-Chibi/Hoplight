/**
 * Setting a block aside, and reading what has been set aside.
 *
 * THE LOAD-BEARING TEST IS THE ORDER. Burying is two writes - a copy into the graveyard and a
 * removal from the preset - and the whole feature is only trustworthy if the copy lands first. A
 * removal that succeeds while the copy fails destroys writing that the person was told was safe.
 */
import { describe, expect, test } from "bun:test";
import type { KitBridge, KitEntity } from "../bridge";
import type { ToolContext } from "./tool";
import { EMPTY_GRAVEYARD, type GraveyardFile } from "../../studio/graveyard-shape";
import graveyard from "./graveyard";
import bury from "./graveyard-bury";

const PRESET = {
  kind: "preset",
  id: "astrolabe",
  body: {
    name: "Astrolabe",
    prompts: [
      { id: "north-star-ii", name: "NORTH STAR II", content: "the proctor's copy", role: "system" },
      { id: "keeper", name: "Keeper", content: "stays", role: "system" },
    ],
  },
} as unknown as KitEntity;

const bridge: KitBridge = {
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind, id) { return kind === "preset" && id === "astrolabe" ? PRESET : null; },
  async save() { throw new Error("bury must not save directly"); },
  async delete() { return false; },
};

/** A graveyard in memory, plus the ability to make its write fail. */
function fakeYard(failWrite = false) {
  let file: GraveyardFile = EMPTY_GRAVEYARD;
  return {
    seam: {
      read: async () => file,
      edit: async (change: (c: GraveyardFile) => GraveyardFile) => {
        if (failWrite) throw new Error("disk full");
        file = change(file);
        return file;
      },
    },
    get current() { return file; },
  };
}

const ctxWith = (yard: ReturnType<typeof fakeYard>, changes?: unknown): ToolContext =>
  ({ bridge, graveyard: yard.seam, now: () => 1_000, ...(changes ? { changes } : {}) }) as unknown as ToolContext;

describe("burying a block", () => {
  test("the block is kept whole, with where it came from", async () => {
    const yard = fakeYard();
    await bury.execute({ preset: "astrolabe", blockId: "north-star-ii" }, ctxWith(yard));
    const grave = yard.current.graves[0];
    expect(grave?.block.content).toBe("the proctor's copy");
    expect(grave?.from).toEqual({ presetId: "astrolabe", presetName: "Astrolabe" });
  });

  test("THE COPY LANDS BEFORE THE REMOVAL IS EVEN STAGED", async () => {
    /**
     * The order is the safety property. If the graveyard write fails, nothing has been taken out of
     * the preset and the person is exactly where they started - the only failure worth having.
     */
    const yard = fakeYard(true);
    await expect(
      bury.execute({ preset: "astrolabe", blockId: "north-star-ii" }, ctxWith(yard)),
    ).rejects.toThrow("disk full");
    // And the preset was never touched: no draft was composed, because we never got that far.
    expect(yard.current.graves).toHaveLength(0);
  });

  test("the removal is a DRAFT, so it meets the ordinary review", async () => {
    const yard = fakeYard();
    let revised: unknown = null;
    // A real draft carries the target it is about; reviewChangeDraft reads it to say what changes.
    const changes = {
      revise: (_e: unknown, next: unknown, op: unknown) => {
        revised = next;
        return {
          id: "d1", mode: "update", baseline: PRESET, proposed: next, warnings: [],
          target: { kind: "preset", id: "astrolabe" }, operations: [op],
        };
      },
    };
    const result = await bury.execute(
      { preset: "astrolabe", blockId: "north-star-ii", note: "too long" },
      ctxWith(yard, changes),
    );
    expect(result.outcome).toBe("draft");
    const body = (revised as { body: { prompts: { id: string }[] } }).body;
    expect(body.prompts.map((p) => p.id)).toEqual(["keeper"]);
    // The note the person gave rides with the grave, which is often the useful part later.
    expect(yard.current.graves[0]?.note).toBe("too long");
  });

  test("A BLOCK THAT IS NOT THERE IS NOT BURIED", async () => {
    // Otherwise a typo puts an empty grave in the drawer and reports success.
    const yard = fakeYard();
    const got = await bury.execute({ preset: "astrolabe", blockId: "ghost" }, ctxWith(yard));
    expect(got.output).toContain("no block");
    expect(yard.current.graves).toHaveLength(0);
  });

  test("a session with no graveyard says so rather than pretending", async () => {
    const got = await bury.execute({ preset: "astrolabe", blockId: "keeper" }, { bridge } as ToolContext);
    expect(got.output).toContain("no graveyard");
  });
});

describe("reading the graveyard", () => {
  test("an empty one says so, and does not invite invention", async () => {
    const got = await graveyard.execute({}, ctxWith(fakeYard()));
    expect(got.output).toContain("empty");
  });

  test("it lists what is buried, newest first, with where each came from", async () => {
    const yard = fakeYard();
    await bury.execute({ preset: "astrolabe", blockId: "keeper" }, ctxWith(yard));
    await bury.execute({ preset: "astrolabe", blockId: "north-star-ii" }, ctxWith(yard));
    const got = await graveyard.execute({}, ctxWith(yard));
    expect(got.output).toContain("NORTH STAR II");
    expect(got.output).toContain("from Astrolabe");
  });

  test("READING ONE BY ID GIVES THE WHOLE BLOCK", async () => {
    // The point of a graveyard is putting the writing back, which needs the writing.
    const yard = fakeYard();
    await bury.execute({ preset: "astrolabe", blockId: "north-star-ii" }, ctxWith(yard));
    const id = yard.current.graves[0]!.id;
    const got = await graveyard.execute({ id }, ctxWith(yard));
    expect(got.output).toContain("the proctor's copy");
  });

  test("IT NEVER WRITES", () => {
    // Looking must not ask permission, which is why burying is a separate tool with its own class.
    expect(graveyard.effect).toBe("read");
    expect(bury.effect).toBe("draft");
  });
});
