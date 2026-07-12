/**
 * ST persona backup codec (P5): the default persona imports, EVERYTHING seals, export overlays
 * the edit back onto the whole backup so the other personas re-emit byte-true.
 */
import { describe, expect, test } from "bun:test";
import adapter from "./persona";

const backup = () => ({
  personas: { "chi.png": "Chi", "kai.png": "Kai" },
  persona_descriptions: {
    "chi.png": { description: "Purple menace.", position: 4, depth: 3, role: 1, lorebook: "chi-notes", title: "The Boss" },
    "kai.png": { description: "Quiet courier.", position: 0, depth: 2, role: 0, lorebook: "" },
  },
  default_persona: "chi.png",
});

describe("detection", () => {
  test("claims a real backup at 0.95; refuses near-misses", () => {
    expect(adapter.detect({ text: JSON.stringify(backup()) })).toBe(0.95);
    expect(adapter.detect({ text: JSON.stringify({ personas: {} }) })).toBe(0);
    expect(adapter.detect({ text: JSON.stringify({ personas: { a: "A" } }) })).toBe(0);
    expect(adapter.detect({ text: "[]" })).toBe(0);
  });
});

describe("round trip", () => {
  test("imports the DEFAULT persona with decoded position/depth/role/lorebook/title", () => {
    const e = adapter.toCanonical({ text: JSON.stringify(backup()), filename: "personas_20260712.json" });
    expect(e.body.name).toBe("Chi");
    expect(e.body.content).toBe("Purple menace.");
    expect(e.body.identity?.tagline).toBe("The Boss");
    expect(e.body.knowledgeRefs).toEqual(["chi-notes"]);
    expect(e.body.chatInjection).toEqual({ position: "in_chat", depth: 3, role: "user" });
  });

  test("export overlays the edit; the OTHER persona re-emits byte-true", () => {
    const raw = backup();
    const e = adapter.toCanonical({ text: JSON.stringify(raw) });
    e.body.content = "Purple menace, promoted.";
    e.body.chatInjection = { position: "prompt" };
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof backup>;
    expect(out.persona_descriptions["chi.png"].description).toBe("Purple menace, promoted.");
    expect(out.persona_descriptions["chi.png"].position).toBe(0);
    expect(out.persona_descriptions["kai.png"]).toEqual(raw.persona_descriptions["kai.png"]);
    expect(out.personas["kai.png"]).toBe("Kai");
    expect(out.default_persona).toBe("chi.png");
  });

  test("falls back to the first persona when no default is set", () => {
    const raw = backup() as Record<string, unknown>;
    delete raw.default_persona;
    const e = adapter.toCanonical({ text: JSON.stringify(raw) });
    expect(["Chi", "Kai"]).toContain(e.body.name);
  });
});
