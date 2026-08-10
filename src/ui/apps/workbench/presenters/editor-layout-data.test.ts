/**
 * Every editable field has somewhere to be drawn.
 *
 * WHY THIS EXISTS. `ACTS` is a hand-kept list of field ids, and the acts presenter draws exactly
 * what it names. A field missing from every act is therefore invisible in that view - not broken,
 * not erroring, just absent - while the same field renders fine in Bento and is asked for by the
 * guided steps. Nothing anywhere says the three disagree.
 *
 * That reached a user. `description` was in no act, so somebody on Playbill had no field in which to
 * describe their character and could only reach it by going back through the quiz. They assumed the
 * app was hiding it deliberately.
 *
 * The registry is the source of truth for what exists, so this compares against it rather than
 * against a second list somebody has to remember to update.
 */
import { describe, expect, test } from "bun:test";
import { FIELD_MODULES } from "../fields";
import { ACTS } from "./editor-layout-data";

/**
 * Fields the acts view deliberately does not list, because it draws them somewhere else.
 *
 * Named individually and kept short on purpose: an exemption list is how this guard would rot into
 * the thing it replaced, so each entry has to be a place you can point at.
 */
const DRAWN_ELSEWHERE = new Set([
  "portrait", // the left panel, beside the sealed rail - not a field box in an act
]);

describe("the acts layout covers every field", () => {
  test("NO EDITABLE FIELD IS MISSING FROM EVERY ACT", () => {
    const named = new Set(ACTS.flatMap((act) => act.ids));
    const missing = FIELD_MODULES
      .map((field) => field.id)
      .filter((id) => !named.has(id) && !DRAWN_ELSEWHERE.has(id));
    expect(missing).toEqual([]);
  });

  test("and no act names a field that does not exist", () => {
    // The other direction: a renamed field leaves a dead id behind, and a dead id draws nothing
    // while looking like coverage.
    const real = new Set(FIELD_MODULES.map((field) => field.id));
    const ghosts = ACTS.flatMap((act) => act.ids).filter((id) => !real.has(id));
    expect(ghosts).toEqual([]);
  });

  test("a field belongs to exactly one act", () => {
    // Two acts claiming one field draws it twice, and two boxes writing one path is the editing bug
    // that looks like the app losing your text.
    const seen = new Map<string, number>();
    for (const id of ACTS.flatMap((act) => act.ids)) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });
});
