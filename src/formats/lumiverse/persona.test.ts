/** Lumiverse persona codec (P5): pronoun triplet is DATA; wire-only fields re-emit from the twin. */
import { describe, expect, test } from "bun:test";
import adapter from "./persona";

const wire = () => ({
  id: "p1",
  name: "Ada",
  title: "The Boss",
  description: "Purple menace.",
  subjective_pronoun: "she",
  objective_pronoun: "her",
  possessive_pronoun: "hers",
  avatar_path: "/img/chi.png",
  image_id: null,
  attached_world_book_id: "wb-9",
  folder: "mains",
  is_default: true,
  is_narrator: false,
  metadata: { theme: "violet" },
  created_at: 1720000000,
  updated_at: 1720000001,
});

describe("detection", () => {
  test("claims the pronoun-triplet object at 0.95 (outbids the ST v1-card heuristic); refuses others", () => {
    expect(adapter.detect({ text: JSON.stringify(wire()) })).toBe(0.95);
    expect(adapter.detect({ text: JSON.stringify({ name: "X", description: "d" }) })).toBe(0);
    expect(adapter.detect({ text: "[]" })).toBe(0);
  });
});

describe("round trip", () => {
  test("triplet, tagline, book, avatar map in; folder/narrator/metadata seal and re-emit", () => {
    const e = adapter.toCanonical({ text: JSON.stringify(wire()) });
    expect(e.body.identity?.pronounSet).toEqual({ subjective: "she", objective: "her", possessive: "hers" });
    expect(e.body.identity?.tagline).toBe("The Boss");
    expect(e.body.knowledgeRefs).toEqual(["wb-9"]);
    expect(e.body.presentation?.imageUrl).toBe("/img/chi.png");
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof wire>;
    expect(out).toEqual(wire());
  });

  test("edits land on the wire", () => {
    const e = adapter.toCanonical({ text: JSON.stringify(wire()) });
    e.body.identity = { ...e.body.identity, pronounSet: { subjective: "they", objective: "them", possessive: "theirs" } };
    e.body.content = "Rewritten.";
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof wire>;
    expect(out.subjective_pronoun).toBe("they");
    expect(out.description).toBe("Rewritten.");
    expect(out.folder).toBe("mains"); // sealed survives
  });
});
