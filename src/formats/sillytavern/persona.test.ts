/**
 * ST persona backup codec (P5): the default persona imports, EVERYTHING seals, export overlays
 * the edit back onto the whole backup so the other personas re-emit byte-true.
 */
import { describe, expect, test } from "bun:test";
import adapter from "./persona";

const backup = () => ({
  personas: { "ada.png": "Ada", "kai.png": "Kai" },
  persona_descriptions: {
    "ada.png": { description: "Purple menace.", position: 4, depth: 3, role: 1, lorebook: "ada-notes", title: "The Boss" },
    "kai.png": { description: "Quiet courier.", position: 0, depth: 2, role: 0, lorebook: "" },
  },
  default_persona: "ada.png",
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
    expect(e.body.name).toBe("Ada");
    expect(e.body.content).toBe("Purple menace.");
    expect(e.body.identity?.tagline).toBe("The Boss");
    expect(e.body.knowledgeRefs).toEqual(["ada-notes"]);
    expect(e.body.chatInjection).toEqual({ position: "in_chat", depth: 3, role: "user" });
  });

  test("export overlays the edit; the OTHER persona re-emits byte-true", () => {
    const raw = backup();
    const e = adapter.toCanonical({ text: JSON.stringify(raw) });
    e.body.content = "Purple menace, promoted.";
    e.body.chatInjection = { position: "prompt" };
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof backup>;
    expect(out.persona_descriptions["ada.png"].description).toBe("Purple menace, promoted.");
    expect(out.persona_descriptions["ada.png"].position).toBe(0);
    expect(out.persona_descriptions["kai.png"]).toEqual(raw.persona_descriptions["kai.png"]);
    expect(out.personas["kai.png"]).toBe("Kai");
    expect(out.default_persona).toBe("ada.png");
  });

  test("clearing the tagline drops the title; it must not revert to the stale twin", () => {
    const e = adapter.toCanonical({ text: JSON.stringify(backup()) });
    expect(e.body.identity?.tagline).toBe("The Boss"); // precondition: imported carrying a title
    e.body.identity = undefined; // the user clears it
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as {
      persona_descriptions: Record<string, Record<string, unknown>>;
    };
    expect("title" in out.persona_descriptions["ada.png"]!).toBe(false);
  });

  test("falls back to the first persona when no default is set", () => {
    const raw = backup() as Record<string, unknown>;
    delete raw.default_persona;
    const e = adapter.toCanonical({ text: JSON.stringify(raw) });
    expect(["Ada", "Kai"]).toContain(e.body.name);
  });

  // The smallest wire readBackup accepts: one named persona whose descriptor carries only a
  // description (position/depth/role/lorebook/title all absent). Unedited round-trip must not
  // fabricate any of those keys (the Round-Trip Law: fromCanonical invents nothing the source lacked).
  const minimal = () => ({
    personas: { "u.png": "User" },
    persona_descriptions: { "u.png": { description: "Just me." } },
    default_persona: "u.png",
  });

  test("minimal descriptor round-trips byte-true: no fabricated position/depth/role/lorebook", () => {
    const src = minimal();
    const e = adapter.toCanonical({ text: JSON.stringify(src) });
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "");
    expect(out).toEqual(src);
  });
});
