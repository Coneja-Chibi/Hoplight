import { expect, test } from "bun:test";
import {
  applyEdits,
  computeDirty,
  getAtPath,
  IDENTITY_FIELDS,
  KNOWN_FIELD_ORDER,
  moveCard,
  PROSE_CARDS,
  reconcileOrder,
} from "./editor-core";

const RENDERED = new Set(PROSE_CARDS.map((c) => c.id));

test("reconcileOrder: absent/junk reads as the default order", () => {
  expect(reconcileOrder(undefined)).toEqual(KNOWN_FIELD_ORDER);
  expect(reconcileOrder(null)).toEqual(KNOWN_FIELD_ORDER);
  expect(reconcileOrder([])).toEqual(KNOWN_FIELD_ORDER);
  expect(reconcileOrder([42, "nonsense"])).toEqual(KNOWN_FIELD_ORDER);
});

test("reconcileOrder: saved positions survive, unknown ids drop, new ids append", () => {
  const saved = ["scenario", "bogus-id", "description", "firstMes"];
  expect(reconcileOrder(saved)).toEqual([
    "scenario",
    "description",
    "firstMes",
    "personality",
    "alternateGreetings",
    "mesExample",
    "creators-note",
  ]);
});

test("moveCard swaps with the adjacent rendered card", () => {
  const order = ["description", "personality", "scenario", "firstMes", "alternateGreetings", "mesExample", "creators-note"];
  const next = moveCard(order, "personality", -1, RENDERED);
  expect(next.slice(0, 2)).toEqual(["personality", "description"]);
});

test("moveCard skips unrendered ids and leaves them in place", () => {
  // firstMes and mesExample are separated by alternateGreetings (unrendered this slice)
  const order = ["description", "personality", "scenario", "firstMes", "alternateGreetings", "mesExample", "creators-note"];
  const next = moveCard(order, "firstMes", 1, RENDERED);
  expect(next).toEqual(["description", "personality", "scenario", "mesExample", "alternateGreetings", "firstMes", "creators-note"]);
});

test("moveCard at the rendered edge is a no-op (same reference)", () => {
  const order = [...KNOWN_FIELD_ORDER];
  expect(moveCard(order, "description", -1, RENDERED)).toBe(order);
  // mesExample is the LAST rendered card; below it sits only unrendered creators-note
  expect(moveCard(order, "mesExample", 1, RENDERED)).toBe(order);
});

test("getAtPath reads strings and treats absence/non-strings as empty", () => {
  const body = { identity: { description: "tall" }, persona: { structured: { kind: "text" } } };
  expect(getAtPath(body, ["identity", "description"])).toBe("tall");
  expect(getAtPath(body, ["persona", "personality"])).toBe("");
  expect(getAtPath(body, ["persona", "structured"])).toBe("");
  expect(getAtPath(undefined, ["identity", "name"])).toBe("");
});

test("applyEdits sets values, deletes empties, and NEVER touches unedited fields", () => {
  const body = {
    identity: { name: "Lucio", description: "old words" },
    persona: { personality: "wry" },
    behavior: { virtualScript: "opaque payload" },
    escrowish: { deep: { blob: [1, 2, 3] } },
  };
  const edits = new Map([
    ["description", "new words"],
    ["personality", ""],
  ]);
  const out = applyEdits(body, edits, PROSE_CARDS);
  expect(getAtPath(out, ["identity", "description"])).toBe("new words");
  expect("personality" in (out.persona as Record<string, unknown>)).toBe(false);
  // the no-data-loss property: everything untouched is byte-identical
  expect(out.behavior).toEqual(body.behavior);
  expect(out.escrowish).toEqual(body.escrowish);
  expect(getAtPath(out, ["identity", "name"])).toBe("Lucio");
  // and the input body was not mutated
  expect(getAtPath(body, ["identity", "description"])).toBe("old words");
});

test("applyEdits builds missing parents when a new field is set", () => {
  const out = applyEdits({}, new Map([["firstMes", "hey"]]), PROSE_CARDS);
  expect(getAtPath(out, ["greetings", "firstMessage"])).toBe("hey");
});

test("computeDirty: edits equal to baseline are clean; '' equals absent", () => {
  const baseline = { identity: { description: "same" } };
  const clean = new Map([
    ["description", "same"],
    ["personality", ""],
  ]);
  expect(computeDirty(baseline, clean, PROSE_CARDS, KNOWN_FIELD_ORDER, KNOWN_FIELD_ORDER)).toBe(false);
  const dirty = new Map([["description", "changed"]]);
  expect(computeDirty(baseline, dirty, PROSE_CARDS, KNOWN_FIELD_ORDER, KNOWN_FIELD_ORDER)).toBe(true);
});

test("computeDirty: a reorder alone is dirty", () => {
  const moved = moveCard(KNOWN_FIELD_ORDER, "personality", -1, RENDERED);
  expect(computeDirty({}, new Map(), PROSE_CARDS, KNOWN_FIELD_ORDER, moved)).toBe(true);
});

test("identity fields cover the casting card and bind to identity paths", () => {
  for (const f of IDENTITY_FIELDS) expect(f.path[0]).toBe("identity");
  expect(IDENTITY_FIELDS.map((f) => f.id)).toEqual(["name", "tagline", "fullName", "title", "age", "pronouns"]);
});
