/**
 * Edit rules for the resolved live preview: splices are guarded by staleness checks, branch
 * edits keep the other options, and every refusal is a null - never a wrong splice.
 */
import { describe, expect, test } from "bun:test";
import { processMacros, type MacroContext } from "../macros";
import { editChoiceOption, segmentIsCurrent, spliceSegment } from "./live-edit";

const ctx = (): MacroContext => ({
  characterName: "Sera",
  userName: "Chi",
  localVariables: new Map(),
  globalVariables: new Map(),
  randomSeed: 7,
});

const seg = (source: string, index: number) => {
  const s = processMacros(source, ctx()).segments[index];
  if (!s) throw new Error(`no segment ${index}`);
  return s;
};

describe("spliceSegment", () => {
  test("a literal edit splices exactly the authored range", () => {
    const src = "Hello {{char}}!";
    const lit = seg(src, 0);
    expect(spliceSegment(src, lit, "Greetings ")).toBe("Greetings {{char}}!");
  });

  test("an escaped-brace literal splices without corrupting the escapes", () => {
    const src = "keep \\{\\{char\\}\\} safe";
    const lit = seg(src, 0);
    expect(spliceSegment(src, lit, "still \\{\\{char\\}\\} safe")).toBe("still \\{\\{char\\}\\} safe");
  });

  test("a whole macro expression can be replaced through its segment", () => {
    const src = "Roll: {{random::a::b}}";
    const mac = seg(src, 1);
    expect(spliceSegment(src, mac, "{{random::a::b::c}}")).toBe("Roll: {{random::a::b::c}}");
  });

  test("a stale segment refuses instead of splicing the wrong characters", () => {
    const src = "Hello {{char}}!";
    const lit = seg(src, 0);
    const changed = "Hi {{char}}!"; // block content moved under the preview
    expect(segmentIsCurrent(changed, lit)).toBe(false);
    expect(spliceSegment(changed, lit, "X")).toBeNull();
  });
});

describe("editChoiceOption", () => {
  test("rewrites one :: option and keeps the rest", () => {
    const src = "{{random::growls::snarls::hisses}}";
    const mac = seg(src, 0);
    if (mac.kind !== "macro") throw new Error("expected macro segment");
    expect(editChoiceOption(mac, 1, "bares his teeth")).toBe(
      "{{random::growls::bares his teeth::hisses}}",
    );
  });

  test("rewrites one comma option inside a single :: arg", () => {
    const src = "{{random::a,b,c}}";
    const mac = seg(src, 0);
    if (mac.kind !== "macro") throw new Error("expected macro segment");
    expect(editChoiceOption(mac, 2, "z")).toBe("{{random::a,b,z}}");
  });

  test("refuses nested-macro expressions and out-of-range or stale options", () => {
    const nested = seg("{{random::{{char}}::b}}", 0);
    if (nested.kind !== "macro") throw new Error("expected macro segment");
    expect(editChoiceOption(nested, 0, "x")).toBeNull(); // no choice detail on nested options

    const mac = seg("{{random::a::b}}", 0);
    if (mac.kind !== "macro") throw new Error("expected macro segment");
    expect(editChoiceOption(mac, 5, "x")).toBeNull();
  });

  test("a branch edit round-trips: splice back, re-render, options updated", () => {
    const src = "Voice: {{random::soft::sharp}}";
    const mac = seg(src, 1);
    if (mac.kind !== "macro") throw new Error("expected macro segment");
    const newRaw = editChoiceOption(mac, 0, "velvet");
    if (newRaw === null) throw new Error("edit refused");
    const next = spliceSegment(src, mac, newRaw);
    if (next === null) throw new Error("splice refused");
    const rerendered = processMacros(next, ctx()).segments[1];
    if (rerendered?.kind !== "macro" || rerendered.detail?.kind !== "choice") {
      throw new Error("expected choice detail after edit");
    }
    expect(rerendered.detail.options).toEqual(["velvet", "sharp"]);
  });
});
