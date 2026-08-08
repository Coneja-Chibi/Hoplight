/**
 * What the agent is told about somebody's groupings.
 *
 * The tests that matter are about what the OUTPUT says, because this tool's whole job is to hand a
 * model a true account of what the person filed together. A pleasant-looking summary that hides a
 * deleted member teaches the model to repeat the omission back as fact.
 */
import { describe, expect, test } from "bun:test";
import type { KitBridge } from "../bridge";
import { EMPTY_COLLECTIONS } from "../../studio/collections-shape";
import tool from "./collections";

const PIECES = [
  { kind: "character", id: "basil-1", name: "Basil" },
  { kind: "character", id: "levi-2", name: "Levi" },
  { kind: "preset", id: "clean", name: "Clean" },
];

const bridgeWith = (collections: KitBridge["collections"]): KitBridge => ({
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return PIECES; },
  async read() { return null; },
  async save() { throw new Error("not used"); },
  async delete() { return false; },
  ...(collections ? { collections } : {}),
});

const run = async (input: { id?: string }, bridge: KitBridge) =>
  tool.execute(input, { bridge } as Parameters<typeof tool.execute>[1]);

const cast = {
  collections: [{
    id: "the-cast",
    name: "The Cast",
    members: [{ kind: "character", id: "basil-1" }, { kind: "character", id: "levi-2" }],
  }],
};

describe("studio_collections", () => {
  test("IT NEVER WRITES", () => {
    // The seam is read-only on purpose: an agent quietly refiling somebody's studio would look like
    // the app rearranged itself.
    expect(tool.effect).toBe("read");
  });

  test("a studio with no groupings says so plainly", async () => {
    const got = await run({}, bridgeWith(async () => EMPTY_COLLECTIONS));
    expect(got.output).toContain("No collections yet");
    // The model must not infer that it should invent groupings to be helpful.
    expect(got.output).toContain("nothing here is automatic");
  });

  test("A BRIDGE WITHOUT THE SEAM IS NOT A CRASH", async () => {
    // The seam is optional so older bridges and test doubles still satisfy KitBridge. Reaching
    // through it unguarded would take down any session running against one.
    const got = await run({}, bridgeWith(undefined));
    expect(got.output).toContain("No collections yet");
  });

  test("each collection lists its pieces with the marker that points at it", async () => {
    const got = await run({}, bridgeWith(async () => cast));
    expect(got.output).toContain("The Cast (@collection:the-cast)");
    expect(got.output).toContain("2 pieces");
    expect(got.output).toContain("character:basil-1  Basil");
    expect(got.output).toContain("character:levi-2  Levi");
  });

  test("MEMBERS KEEP THE ORDER SOMEBODY PUT THEM IN", async () => {
    // The one thing a hand-built collection carries that a search result does not.
    const got = await run({}, bridgeWith(async () => ({
      collections: [{
        id: "c", name: "C",
        members: [{ kind: "preset", id: "clean" }, { kind: "character", id: "basil-1" }],
      }],
    })));
    expect(got.output.indexOf("preset:clean")).toBeLessThan(got.output.indexOf("character:basil-1"));
  });

  test("A DELETED MEMBER IS NAMED, NOT QUIETLY DROPPED", async () => {
    /**
     * The failure this feature was always going to have: pieces are deleted by tools that know
     * nothing about collections. If the tool reported "1 piece" and moved on, the model would repeat
     * the shorter list back as the truth and nobody would ever learn what went missing.
     */
    const got = await run({}, bridgeWith(async () => ({
      collections: [{
        id: "c", name: "C",
        members: [{ kind: "character", id: "basil-1" }, { kind: "character", id: "ghost" }],
      }],
    })));
    expect(got.output).toContain("no longer in the studio");
    expect(got.output).toContain("character:ghost");
  });

  test("an empty collection reads as empty rather than as an error", async () => {
    const got = await run({}, bridgeWith(async () => ({
      collections: [{ id: "c", name: "C", members: [] }],
    })));
    expect(got.output).toContain("(empty)");
  });

  test("one id narrows to that collection", async () => {
    const two = {
      collections: [
        ...cast.collections,
        { id: "act-ii", name: "Act II", members: [{ kind: "preset", id: "clean" }] },
      ],
    };
    const got = await run({ id: "act-ii" }, bridgeWith(async () => two));
    expect(got.output).toContain("Act II");
    expect(got.output).not.toContain("The Cast");
  });

  test("AN UNKNOWN ID SAYS WHAT DOES EXIST", async () => {
    // Otherwise the model's next move is to guess again, and it guesses from nothing.
    const got = await run({ id: "nope" }, bridgeWith(async () => cast));
    expect(got.output).toContain('No collection with id "nope"');
    expect(got.output).toContain("the-cast");
  });

  test("a note the person wrote is carried through", async () => {
    const got = await run({}, bridgeWith(async () => ({
      collections: [{ id: "c", name: "C", note: "everyone in act two", members: [] }],
    })));
    expect(got.output).toContain("everyone in act two");
  });
});
