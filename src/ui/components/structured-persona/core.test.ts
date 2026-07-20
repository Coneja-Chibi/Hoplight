/** Regression coverage for the core.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import {
  addAttribute,
  normalizePersona,
  setKind,
  setText,
  toWire,
} from "./core";

test("normalizePersona defaults empty", () => {
  const p = normalizePersona(null);
  expect(p.kind).toBe("text");
  expect(p.attributes.text).toEqual([""]);
});

test("normalizePersona reads attributes map", () => {
  const p = normalizePersona({
    kind: "attributes",
    attributes: { species: ["robot"], personality: ["kind"] },
  });
  expect(p.kind).toBe("attributes");
  expect(p.attributes.species).toEqual(["robot"]);
});

test("setKind text collapses to single text", () => {
  const p = setKind(
    { kind: "attributes", attributes: { species: ["robot"] } },
    "text",
  );
  expect(p.kind).toBe("text");
  expect(p.attributes.text?.[0]).toBe("robot");
});

test("toWire text is kind-only (personality is the prose field)", () => {
  const p = setText(normalizePersona(null), "hello");
  expect(toWire(p)).toEqual({ kind: "text" });
});

test("addAttribute picks free key", () => {
  const p = addAttribute({ kind: "attributes", attributes: { trait: ["a"] } });
  expect(Object.keys(p.attributes)).toContain("trait_2");
});
