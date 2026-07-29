/** @jsxImportSource @opentui/react */
/**
 * The confirm's look, pinned where it can regress silently.
 *
 * Two properties matter more than any layout detail. The choice row must carry GLYPHS and never
 * printed letters, because a row of bracketed keys is what made this surface read as unfinished. And
 * the KEYS must keep working regardless, because the glyphs replaced what is drawn, not what is
 * bound - a confirm nobody can answer would be a far worse outcome than an ugly one.
 */
import { expect, test } from "bun:test";
import { settleRender as tick, testRender } from "../../test-render";
import { CHECK, CROSS, HELD, STOP } from "../../glyphs";
import { GatePrompt } from "./gate-prompt";
import type { GateChoice } from "../../../tools/safety/permission-mode";
import type { GateRequest } from "../../../tools/safety/gated-dispatch";

const danger = {
  name: "studio_delete",
  verdict: { access: "delete", level: "danger", reason: "removes a stored piece" },
  peek: {
    title: "studio_delete",
    detail: "preset / paramnesia-vi-rc",
    level: "danger",
    reason: "removes a stored piece",
  },
} as unknown as GateRequest;

const caution = {
  name: "studio_export",
  verdict: { access: "write", level: "caution", reason: "writes a file" },
  peek: { title: "studio_export", detail: "exports / a.json", level: "caution", reason: "writes a file" },
} as unknown as GateRequest;

const frameOf = async (req: GateRequest, onChoice: (c: GateChoice) => void = () => {}) => {
  const rendered = await testRender(
    <GatePrompt req={req} mode="guarded" onChoice={onChoice} />,
    { width: 76, height: 14 },
  );
  await tick(60);
  return rendered;
};

test("the choice row is glyphs, and prints no bracketed letters", async () => {
  const rendered = await frameOf(danger);
  try {
    const frame = rendered.captureCharFrame();
    for (const glyph of [CHECK, CROSS, HELD, STOP]) expect(frame).toContain(glyph);
    // The exact strings this redesign existed to remove.
    for (const dead of ["[y]", "[a]", "[n]", "[!]", "allow once", "allow all session", "GATE"]) {
      expect(frame).not.toContain(dead);
    }
  } finally {
    await rendered.renderer.destroy();
  }
});

test("the keys still answer it, because only the drawing changed", async () => {
  // If this ever fails, the redesign has taken the confirm away from the keyboard, which is the one
  // outcome worse than the old look.
  for (const [key, expected] of [["y", "allow-once"], ["a", "allow-session"], ["n", "deny"]] as const) {
    let picked = "";
    const rendered = await frameOf(danger, (c) => { picked = c.type; });
    try {
      rendered.mockInput.pressKey(key);
      await tick(60);
      expect(picked).toBe(expected);
    } finally {
      await rendered.renderer.destroy();
    }
  }
});

test("escape still denies", async () => {
  let picked = "";
  const rendered = await frameOf(danger, (c) => { picked = c.type; });
  try {
    rendered.mockInput.pressEscape();
    await tick(60);
    expect(picked).toBe("deny");
  } finally {
    await rendered.renderer.destroy();
  }
});

test("danger and caution no longer read as the same event", async () => {
  // They used to differ by the colour of one leading bar. The banner states the level in words.
  const hot = await frameOf(danger);
  try {
    expect(hot.captureCharFrame()).toContain("DANGER");
  } finally {
    await hot.renderer.destroy();
  }

  const warm = await frameOf(caution);
  try {
    const frame = warm.captureCharFrame();
    expect(frame).toContain("CAUTION");
    expect(frame).not.toContain("DANGER");
  } finally {
    await warm.renderer.destroy();
  }
});
