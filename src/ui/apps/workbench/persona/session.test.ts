/** P4 session ops: pure, immutable, nested-slot honest. */
import { describe, expect, it } from "bun:test";
import type { PersonaBody } from "../../../../entities/persona/schema";
import {
  patchIdentity,
  patchInjection,
  patchSections,
  personaDirty,
  setPortrait,
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

  it("setPortrait writes the media slot and clearing drops it entirely", () => {
    const asset = { role: "portrait" as const, ref: "data:image/png;base64,AAAA", primary: true };
    const b = setPortrait(base(), asset);
    expect(b.media?.portrait?.ref).toBe(asset.ref);
    const cleared = setPortrait(b, null);
    expect(cleared.media).toBeUndefined();
    expect(JSON.stringify(cleared)).toBe(JSON.stringify(base()));
  });

  it("toggleTrait dedupes and removes on second toggle; blanks ignored", () => {
    let b = toggleTrait(base(), "Blunt");
    b = toggleTrait(b, "Blunt");
    expect(b.traits).toEqual([]);
    expect(toggleTrait(base(), "  ").traits).toBeUndefined();
  });
});
