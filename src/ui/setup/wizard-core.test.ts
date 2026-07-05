/**
 * wizard-core tests - the pure logic the first-run wizard renders from: defaults, pressed state,
 * multi-select with the "Not sure yet" clears stance, derived progress, and the summary sentence.
 */
import { describe, expect, test } from "bun:test";
import type { SetupOption, SetupStepManifest } from "./step-contract";
import { defaultValue, isPressed, nextMultiSelection, progressLabel, sentencePlan } from "./wizard-core";

const manifest = (over: Partial<SetupStepManifest>): SetupStepManifest => ({
  id: "t",
  order: 1,
  question: "?",
  say: "",
  settingsKey: "k",
  stageNote: "",
  ...over,
});

const opts: SetupOption[] = [
  { id: "a", title: "A" },
  { id: "b", title: "B", isDefault: true },
  { id: "none", title: "Not sure", isDefault: true, clears: true },
];

describe("defaultValue", () => {
  test("single takes the marked default", () => {
    expect(defaultValue(manifest({}), opts.slice(0, 2))).toBe("b");
  });
  test("single falls back to the first option", () => {
    expect(defaultValue(manifest({}), [{ id: "x", title: "X" }])).toBe("x");
  });
  test("multi whose only default is the clears option starts empty (the publish shape)", () => {
    const publishLike: SetupOption[] = [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "none", title: "Not sure", isDefault: true, clears: true },
    ];
    expect(defaultValue(manifest({ multi: true }), publishLike)).toEqual([]);
  });
  test("multi keeps non-clears defaults when a step marks them", () => {
    expect(defaultValue(manifest({ multi: true }), opts)).toEqual(["b"]);
  });
  test("option value overrides id in defaults", () => {
    expect(defaultValue(manifest({}), [{ id: "rose", title: "rose", value: "#e11d48", isDefault: true }])).toBe(
      "#e11d48",
    );
  });
});

describe("isPressed", () => {
  test("single compares the stored value", () => {
    expect(isPressed(opts[1]!, "b", undefined)).toBe(true);
    expect(isPressed(opts[0]!, "b", undefined)).toBe(false);
  });
  test("multi: membership presses; clears presses on empty", () => {
    expect(isPressed(opts[0]!, ["a"], true)).toBe(true);
    expect(isPressed(opts[2]!, [], true)).toBe(true);
    expect(isPressed(opts[2]!, ["a"], true)).toBe(false);
  });
});

describe("nextMultiSelection", () => {
  test("pressing adds, pressing again removes", () => {
    expect(nextMultiSelection([], opts[0]!)).toEqual(["a"]);
    expect(nextMultiSelection(["a"], opts[1]!)).toEqual(["a", "b"]);
    expect(nextMultiSelection(["a", "b"], opts[0]!)).toEqual(["b"]);
  });
  test("clears resets the group", () => {
    expect(nextMultiSelection(["a", "b"], opts[2]!)).toEqual([]);
  });
  test("removing the last pick lands on empty (the clears stance by absence)", () => {
    expect(nextMultiSelection(["a"], opts[0]!)).toEqual([]);
  });
});

describe("progressLabel", () => {
  test("is derived, one-based", () => {
    expect(progressLabel(0, 4)).toBe("1 of 4");
    expect(progressLabel(3, 4)).toBe("4 of 4");
  });
});

describe("sentencePlan", () => {
  test("the locked wireframe sentence assembles exactly", () => {
    const plan = sentencePlan([
      { pre: "a ", strong: "dark", post: " workspace" },
      { pre: "starting with ", strong: "Characters" },
      { pre: "publishing to ", strong: "SillyTavern" },
      { pre: "in ", strong: "rose" },
    ]);
    const text = plan.map((f) => `${f.pre}${f.strong}${f.post}`).join("");
    expect(text).toBe("A dark workspace, starting with Characters, publishing to SillyTavern, in rose.");
  });
  test("nulls are skipped and the period still lands", () => {
    const plan = sentencePlan([{ pre: "a ", strong: "dark", post: " workspace" }, null, null, { pre: "in ", strong: "rose" }]);
    const text = plan.map((f) => `${f.pre}${f.strong}${f.post}`).join("");
    expect(text).toBe("A dark workspace, in rose.");
  });
  test("a lone fragment capitalizes and closes", () => {
    const plan = sentencePlan([{ pre: "a ", strong: "light", post: " workspace" }]);
    expect(plan.map((f) => `${f.pre}${f.strong}${f.post}`).join("")).toBe("A light workspace.");
  });
  test("empty plan is empty", () => {
    expect(sentencePlan([null, null])).toEqual([]);
  });
});
