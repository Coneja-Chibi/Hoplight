/**
 * Opening the rail.
 *
 * Every branch here is a sentence somebody reads and has to act on, so the tests are about the words
 * as much as the outcome. The one that matters most is ambiguity: opening the wrong preset and then
 * rearranging it is worse than asking for one more keystroke.
 */
import { describe, expect, test } from "bun:test";
import { openRail, type PresetSource } from "./open-rail";
import type { OutlineRow } from "../../../core/preset/outline";
import type { PresetBody } from "../../../entities/preset";

const body = (...names: string[]): PresetBody =>
  ({ name: "P", prompts: names.map((name, i) => ({ id: `b${i}`, name, content: "x" })) }) as PresetBody;

const source = (
  pieces: { id: string; name: string }[],
  bodies: Record<string, PresetBody> = {},
): PresetSource => ({
  list: async () => pieces as never,
  read: async (id) => bodies[id],
});

const catcher = () => {
  const seen: { id: string; title: string; rows: readonly OutlineRow[] }[] = [];
  return {
    seen,
    follow: (id: string, title: string, rows: readonly OutlineRow[]) => void seen.push({ id, title, rows }),
  };
};

describe("openRail", () => {
  test("one preset and no argument opens it without asking", async () => {
    // Being asked which of one is a question with a known answer.
    const { seen, follow } = catcher();
    const result = await openRail(
      source([{ id: "solo", name: "Solo" }], { solo: body("A", "B") }),
      "",
      follow,
    );
    expect(result.ok).toBe(true);
    expect(seen[0]!.title).toBe("Solo");
    expect(seen[0]!.rows).toHaveLength(2);
  });

  test("a name matches on id or on display name, case-insensitively", async () => {
    const pieces = [{ id: "paramnesia-vi-rc", name: "Paramnesia VI RC" }];
    const src = source(pieces, { "paramnesia-vi-rc": body("A") });
    for (const query of ["paramnesia", "PARAMNESIA", "vi-rc", "VI RC"]) {
      const { seen, follow } = catcher();
      expect((await openRail(src, query, follow)).ok).toBe(true);
      expect(seen).toHaveLength(1);
    }
  });

  test("several matches never picks one, and names them", async () => {
    // A wrong guess here is a preset somebody then edits believing it is the other one.
    const { seen, follow } = catcher();
    const result = await openRail(
      source([{ id: "para-v5", name: "Para V5" }, { id: "para-v6", name: "Para V6" }]),
      "para",
      follow,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("para-v5");
    expect(result.detail).toContain("para-v6");
    expect(seen).toHaveLength(0);
  });

  test("no argument with several presets asks which, and lists them", async () => {
    const result = await openRail(
      source([{ id: "a", name: "A" }, { id: "b", name: "B" }]),
      "",
      catcher().follow,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("Name one");
    expect(result.detail).toContain("a, b");
  });

  test("no match says so and says what there is", async () => {
    const result = await openRail(source([{ id: "only", name: "Only" }]), "zzz", catcher().follow);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain('No preset matches "zzz"');
    expect(result.detail).toContain("only");
  });

  test("an empty studio says that, rather than that nothing matched", async () => {
    const result = await openRail(source([]), "anything", catcher().follow);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("no presets in the studio");
  });

  test("a piece that cannot be read is named, not silently skipped", async () => {
    const result = await openRail(source([{ id: "broken", name: "Broken" }]), "broken", catcher().follow);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("broken could not be read");
  });

  test("no seam at all reports the feature missing rather than throwing", async () => {
    const result = await openRail(undefined, "x", catcher().follow);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("unavailable");
  });

  test("a piece with no display name falls back to its id for the title", async () => {
    const { seen, follow } = catcher();
    await openRail(source([{ id: "no-name", name: "" }], { "no-name": body("A") }), "", follow);
    expect(seen[0]!.title).toBe("no-name");
  });
});
