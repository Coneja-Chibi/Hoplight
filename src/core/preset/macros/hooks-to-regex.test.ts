/**
 * Rendering a hook machine as regex rules.
 *
 * The shape being produced was not invented here. A real preset already does this by hand, and its
 * rules look like `{{addvar::notebook::$1 /// }}` firing on AI output - a trigger that catches a tag
 * the model emitted and a replacement that stores what it captured. These tests hold the output to
 * that shape, and hold the two places where guessing would produce something that runs while doing
 * less than the original.
 */
import { describe, expect, test } from "bun:test";
import { readStateMachine } from "./state-machine";
import { renderHooksAsRegex } from "./hooks-to-regex";

const machine = (...lines: string[]) => readStateMachine(["hooks:", ...lines].join("\n"));

const hook = (id: string, trigger: string, action: string, fields: string[] = []): string[] => [
  `  - id: ${id}`,
  `    trigger: '${trigger}'`,
  ...fields.map((f) => `    ${f}`),
  "    action:",
  `      - ${action}`,
];

describe("the authored value is what gets written", () => {
  test("a multi-group template survives verbatim", () => {
    // Guessing $1 here would silently drop the second group AND the joining text. This is exactly
    // the value the source preset writes.
    const out = renderHooksAsRegex(machine(
      ...hook("state", "\\[STATE:(.+?)\\|(.+?)\\]", '{ type: append, key: ledger, value: "$1 = $2 /// " }'),
    ));
    expect(out.rules[0]?.replace).toContain("{{addvar::ledger::$1 = $2 /// }}");
  });

  test("an authored empty value stays a clear, not a write of the match", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("reset", "^", '{ type: set, key: staged, value: "" }'),
    ));
    expect(out.rules[0]?.replace).toContain("{{setvar::staged::}}");
    expect(out.rules[0]?.replace).not.toContain("$&{{setvar::staged::$&}}");
  });

  test("an omitted value falls back to what the trigger captured", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("catch", "\\[X:(.+?)\\]", "{ type: set, key: k }"),
    ));
    expect(out.rules[0]?.replace).toContain("{{setvar::k::$1}}");
  });
});

describe("strip decides whether the matched text survives", () => {
  test("a stripping hook removes the tag from the passage", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("tag", "\\[X:(.+?)\\]", "{ type: set, key: k }", ["strip: true"]),
    ));
    expect(out.rules[0]?.replace.startsWith("$&")).toBe(false);
  });

  test("a non-stripping hook re-emits the match before writing", () => {
    // Without this the rule would delete authored text as a side effect of storing it.
    const out = renderHooksAsRegex(machine(
      ...hook("tag", "\\[X:(.+?)\\]", "{ type: set, key: k }", ["strip: false"]),
    ));
    expect(out.rules[0]?.replace.startsWith("$&")).toBe(true);
  });
});

describe("what is refused rather than approximated", () => {
  test("a list append is reported unrendered, with the reason", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("collect", "\\[P:(.+?)\\]", "{ type: push, key: plan }"),
    ));
    expect(out.rules).toEqual([]);
    expect(out.unrendered[0]?.id).toBe("collect");
    expect(out.unrendered[0]?.reason).toContain("one rule per slot");
  });

  test("a hook with no actions produces nothing and says so", () => {
    const out = renderHooksAsRegex(machine("  - id: empty", "    trigger: 'x'"));
    expect(out.rules).toEqual([]);
    expect(out.unrendered[0]?.reason).toContain("no actions");
  });
});

describe("order and placement", () => {
  test("declaration order is preserved, because a reset must precede its writers", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("reset", "^", '{ type: set, key: staged, value: "" }'),
      ...hook("writer", "\\[X:(.+?)\\]", "{ type: set, key: staged }"),
    ));
    expect(out.rules.map((r) => r.label)).toEqual(["reset", "writer"]);
    expect(out.rules.map((r) => r.sortOrder)).toEqual([0, 1]);
    expect(out.limits.join(" ")).toContain("must run before");
  });

  test("placement maps onto the phases the target understands", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("both", "x", "{ type: set, key: k }", ["placement: [user_input, ai_output]"]),
    ));
    expect(out.rules[0]?.phases).toEqual(["user_input", "response"]);
  });

  test("the trigger crosses verbatim, and the limits admit it was never compiled", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("t", "(?<=\\[ARC:[^\\]]*)([^,\\]]+)", "{ type: set, key: k }", ["flags: gi"]),
    ));
    expect(out.rules[0]?.find).toBe("(?<=\\[ARC:[^\\]]*)([^,\\]]+)");
    expect(out.rules[0]?.flags).toBe("gi");
    expect(out.limits.join(" ")).toContain("not compiled or validated");
  });
});
