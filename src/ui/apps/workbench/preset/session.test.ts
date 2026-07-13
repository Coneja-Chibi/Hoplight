/** P4 session ops: pure, immutable. */
import { describe, expect, it } from "bun:test";
import type { PresetBody } from "../../../../entities/preset";
import {
  addBlock,
  deleteBlock,
  moveBlock,
  newBlock,
  patchBlock,
  presetDirty,
  toggleBlock,
} from "./session";

const base = (): PresetBody => ({ name: "P", prompts: [] });

describe("preset session ops", () => {
  it("dirty compares deep; baseline untouched by patches", () => {
    const b = base();
    expect(presetDirty(b, base())).toBe(false);
    const edited = addBlock(b, newBlock({ id: "x", name: "X" }));
    expect(presetDirty(edited, b)).toBe(true);
    expect(b.prompts.length).toBe(0);
  });

  it("newBlock mints a fresh id and the ST default shape", () => {
    const a = newBlock();
    const c = newBlock();
    expect(a.id).not.toBe(c.id);
    expect(a.placement).toBe("relative");
    expect(a.role).toBe("system");
    expect(a.enabled).toBe(true);
  });

  it("toggle / delete / patch address one block by id", () => {
    let b = addBlock(base(), newBlock({ id: "a", enabled: true }));
    b = addBlock(b, newBlock({ id: "b", enabled: true }));
    b = toggleBlock(b, "a");
    expect(b.prompts.find((p) => p.id === "a")!.enabled).toBe(false);
    expect(b.prompts.find((p) => p.id === "b")!.enabled).toBe(true);
    b = patchBlock(b, "b", { name: "Renamed" });
    expect(b.prompts.find((p) => p.id === "b")!.name).toBe("Renamed");
    b = deleteBlock(b, "a");
    expect(b.prompts.map((p) => p.id)).toEqual(["b"]);
  });

  it("moveBlock reorders (clamped), missing id is a no-op", () => {
    let b = base();
    for (const id of ["a", "b", "c"]) b = addBlock(b, newBlock({ id }));
    expect(moveBlock(b, "c", 0).prompts.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(moveBlock(b, "a", 99).prompts.map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(moveBlock(b, "missing", 0)).toBe(b);
  });
});
