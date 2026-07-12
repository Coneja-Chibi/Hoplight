/** P4 session ops: pure, immutable, nested-slot honest. */
import { describe, expect, it } from "bun:test";
import type { PersonaBody } from "../../../../entities/persona/schema";
import {
  patchIdentity,
  patchInjection,
  patchSections,
  patchSwatch,
  personaDirty,
  toggleTrait,
} from "./session";

const base = (): PersonaBody => ({ name: "Chi", content: "" });

describe("persona session ops", () => {
  it("dirty compares deep and baseline stays untouched", () => {
    const b = base();
    expect(personaDirty(b, base())).toBe(false);
    const edited = patchIdentity(b, { pronouns: "she/her" });
    expect(personaDirty(edited, b)).toBe(true);
    expect(b.identity).toBeUndefined();
  });

  it("nested patches create the slot on demand", () => {
    const b = patchSections(base(), { quirks: "Hums." });
    expect(b.sections?.quirks).toBe("Hums.");
    const c = patchInjection(base(), { wrapper: "yo" });
    expect(c.chatInjection?.position).toBe("character"); // seeded default
    expect(c.chatInjection?.wrapper).toBe("yo");
  });

  it("toggleTrait dedupes and removes on second toggle; blanks ignored", () => {
    let b = toggleTrait(base(), "Blunt");
    b = toggleTrait(b, "Blunt");
    expect(b.traits).toEqual([]);
    expect(toggleTrait(base(), "  ").traits).toBeUndefined();
  });

  it("patchSwatch appends, replaces, and deletes", () => {
    let b = patchSwatch(base(), 0, { label: "Skin", name: "Cocoa", hex: "#93574b" });
    b = patchSwatch(b, 1, { label: "Hair", name: "Violetta", hex: "#d168f8" });
    b = patchSwatch(b, 0, { label: "Skin", name: "Deep Cocoa", hex: "#7a463c" });
    expect(b.presentation?.colors?.map((c) => c.name)).toEqual(["Deep Cocoa", "Violetta"]);
    b = patchSwatch(b, 0, null);
    expect(b.presentation?.colors?.length).toBe(1);
  });
});
