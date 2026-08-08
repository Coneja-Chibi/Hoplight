/**
 * The one matcher three doors share.
 *
 * `rail_open` from the model, `/rail` in the terminal, and `/rail` in the desktop window all resolve
 * a typed word through this. The tests that matter are the refusals: a matcher that guesses opens
 * somebody's other preset and invites the model to rearrange it.
 */
import { describe, expect, test } from "bun:test";
import { findPreset } from "./find-preset";
import type { EntitySummary } from "../../bridge";

const preset = (id: string, name = ""): EntitySummary => ({ id, kind: "preset", name });

describe("findPreset", () => {
  test("one match, by id or by display name", () => {
    const shelf = [preset("astrolabe", "Astrolabe"), preset("clean", "Clean")];
    expect(findPreset(shelf, "astro")).toEqual({ ok: true, piece: shelf[0]! });
    expect(findPreset(shelf, "Clean")).toEqual({ ok: true, piece: shelf[1]! });
  });

  test("AN EXACT NAME BEATS A LONGER ONE CONTAINING IT", () => {
    /**
     * The bug this rule exists for: "paramnesia" is a substring of "paramnesia-vi", so a pure
     * contains-match found two and refused - and there was no longer string to disambiguate with,
     * because the name typed was already complete. The shorter preset became unreachable.
     */
    const shelf = [preset("paramnesia"), preset("paramnesia-vi")];
    expect(findPreset(shelf, "paramnesia")).toEqual({ ok: true, piece: shelf[0]! });
  });

  test("TWO MATCHES IS A QUESTION, NOT A COIN TOSS", () => {
    // Opening the wrong preset and rearranging it is the failure the whole surface exists to stop.
    const got = findPreset([preset("act-one"), preset("act-two")], "act");
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.detail).toContain("act-one, act-two");
    expect(got.ok === false && got.detail).toContain("do not pick");
  });

  test("no match names what there actually is", () => {
    // Otherwise the next guess is made from nothing, which is how a model tries four wrong ids.
    const got = findPreset([preset("astrolabe")], "nonesuch");
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.detail).toContain("astrolabe");
  });

  test("an empty studio and an empty query each say their own thing", () => {
    expect(findPreset([], "anything")).toEqual({ ok: false, detail: "There are no presets in the studio." });
    expect(findPreset([preset("astrolabe")], "  ")).toEqual({ ok: false, detail: "Name a preset to open." });
  });

  test("matching ignores case and surrounding space, the way people type", () => {
    const shelf = [preset("astrolabe", "Astrolabe")];
    expect(findPreset(shelf, "  ASTRO  ")).toEqual({ ok: true, piece: shelf[0]! });
  });
});
