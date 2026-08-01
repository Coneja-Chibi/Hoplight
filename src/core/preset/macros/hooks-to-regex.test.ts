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
    // The token is the TARGET's, not JavaScript's: SillyTavern expands the replacement itself and
    // never learns what $& means. See the whole-match suite at the foot of this file.
    expect(out.rules[0]?.replace.startsWith("{{match}}")).toBe(true);
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

describe("the whole-match token is the target's, not JavaScript's", () => {
  /**
   * This suite exists because the bug shipped. Rendered rules used `$&`, which is correct JavaScript
   * and wrong here: SillyTavern expands the replacement itself, understands only `$<digits>` and
   * `$<name>`, and returns a finished string, so `$&` survives as literal text AND the matched tag is
   * consumed. Every later rule keyed on that tag then silently stops firing.
   */
  const RENDERED = () => renderHooksAsRegex(machine(
    ...hook("keep", "\[STATE:(.+?)\|(.+?)\]", '{ type: append, key: led, value: "$1 = $2 /// " }'),
    ...hook("nocapture", "\[ARC-END\]", "{ type: set, key: ended }"),
    ...hook("strips", "\[HIDE:(.+?)\]", "{ type: set, key: h }", ["strip: true"]),
  ));

  test("NO rendered rule may contain $&", () => {
    for (const rule of RENDERED().rules) expect(rule.replace).not.toContain("$&");
  });

  test("a non-stripping rule re-emits the match with {{match}}", () => {
    expect(RENDERED().rules[0]?.replace.startsWith("{{match}}")).toBe(true);
  });

  test("a stripping rule still emits no match token, because deleting the tag is the point", () => {
    const strips = RENDERED().rules.find((r) => r.label === "strips");
    expect(strips?.replace.includes("{{match}}")).toBe(false);
  });

  test("the fallback for a trigger with no capture group is {{match}}, not $&", () => {
    const none = RENDERED().rules.find((r) => r.label === "nocapture");
    expect(none?.replace).toContain("{{match}}");
    expect(none?.replace).not.toContain("$&");
  });

  test("an authored template still crosses verbatim, capture groups untouched", () => {
    // The fallback must not overwrite a value the source actually wrote.
    expect(RENDERED().rules[0]?.replace).toContain("$1 = $2 /// ");
  });

  test("the emitted replacement survives the TARGET's expansion, not JavaScript's", () => {
    // A faithful port of SillyTavern's runRegexScript: {{match}} becomes $0, then only $<digits> and
    // $<name> are expanded, and the callback returns a finished string.
    const stExpand = (replaceString: string, args: readonly string[]): string =>
      replaceString
        .replace(/{{match}}/gi, "$0")
        .replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_m, num: string) => (num ? args[Number(num)] ?? "" : ""));

    const rule = RENDERED().rules[0]!;
    const out = stExpand(rule.replace, ["[STATE: mood | wary]", " mood ", " wary "]);
    // The tag is restored, so a later rule keyed on [STATE: still matches.
    expect(out).toContain("[STATE: mood | wary]");
    expect(out).not.toContain("$&");
    expect(out).not.toContain("$0");
  });
});

describe("the rendering checks itself, so a caller with no screen is still told", () => {
  /**
   * travelLint used to be reachable only from the regex editor. Conversions are mostly run by an
   * agent that never opens one, so a rule carrying a token the target cannot execute travelled with
   * nothing said. These assert the finding rides on the result itself.
   */
  test("a clean rendering reports no warnings", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("keep", "\[S:(.+?)\]", '{ type: set, key: k, value: "$1" }'),
    ));
    expect(out.rules.length).toBe(1);
    expect(out.warnings).toEqual([]);
  });

  test("a JavaScript-only token arriving in an AUTHORED value is caught and named", () => {
    // Hook action values cross verbatim, so this is the case that survives our own emitter being
    // right: the source author wrote $& in a RoleCall template.
    const out = renderHooksAsRegex(machine(
      ...hook("carried", "\[S:(.+?)\]", '{ type: set, key: k, value: "$& seen" }'),
    ));
    expect(out.warnings.length).toBe(1);
    expect(out.warnings[0]!.id).toBe("hook-carried");
    expect(out.warnings[0]!.reason).toContain("consumed");
    expect(out.warnings[0]!.reason).toContain("{{match}}");
  });

  test("the warning names the rule, so a receipt can point at which one", () => {
    const out = renderHooksAsRegex(machine(
      ...hook("ok", "\[A:(.+?)\]", '{ type: set, key: a, value: "$1" }'),
      ...hook("bad", "\[B:(.+?)\]", '{ type: set, key: b, value: "$`" }'),
    ));
    expect(out.warnings.map((w) => w.id)).toEqual(["hook-bad"]);
  });

  test("the trigger is NOT linted here, because it is the source author's and already caveated", () => {
    // A look-behind would raise a host-age note on the find field; that belongs to `limits`, not to
    // this conversion's findings, or every RoleCall preset using one would look like our defect.
    const out = renderHooksAsRegex(machine(
      ...hook("lb", "(?<=\[ARC:)([^\]]+)", "{ type: set, key: k }"),
    ));
    expect(out.warnings).toEqual([]);
    expect(out.limits.join(" ")).toContain("not compiled or validated");
  });
});
