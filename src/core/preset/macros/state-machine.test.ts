/**
 * Reading a RoleCall state layer. The fixture is a reduced copy of a real preset's shape: a
 * dashboard with a gated row, and hooks covering every action type, both placements, and both
 * strip settings.
 *
 * The assertions that matter are the honest ones: an absent or broken state layer reports itself
 * rather than throwing or quietly reading as empty.
 */
import { describe, expect, test } from "bun:test";
import {
  censusConditionals,
  readStateMachine,
  variablesWritten,
} from "./state-machine";

const YAML = `dashboard:
  - label: HawThorne in
    value: "{{calc::{{getvar::pacing_floor}} - {{getvar::since_hawthorne}}}} turns"
  - label: Luck roll
    value: "{{getvar::luck_seed}}"
    show_if: "{{getvar::mode_world}}"

# a comment line, ignored
hooks:
  - id: vi-staging-reset
    trigger: '^'
    flags: g
    strip: false
    placement: [user_input, ai_output]
    action:
      - { type: set, key: staging_state_ledger, value: "" }
      - { type: unset, key: staging_propp_plan }

  - id: vi-state
    trigger: '\\[STATE:\\s*(.+?)\\s*\\|\\s*(.+?)\\]'
    flags: gs
    strip: false
    placement: [user_input, ai_output]
    action:
      - { type: append, key: staging_state_ledger, value: "$1 = $2 /// " }

  - id: vi-arc-plan-items
    trigger: '(?<=\\[ARC-PLAN:[^\\]]*)([^,\\]]+)'
    flags: gi
    strip: true
    placement: [ai_output]
    action:
      - { type: push, key: staging_propp_plan, value: "$1" }
`;

describe("readStateMachine", () => {
  test("reads every hook with its trigger, flags, strip and placement", () => {
    const machine = readStateMachine(YAML);
    expect(machine.hooks).toHaveLength(3);
    expect(machine.unparsedLines).toBe(0);

    const [reset, state, items] = machine.hooks;
    expect(reset?.id).toBe("vi-staging-reset");
    expect(reset?.placement).toEqual(["user_input", "ai_output"]);
    expect(reset?.strip).toBe(false);

    expect(state?.trigger).toBe("\\[STATE:\\s*(.+?)\\s*\\|\\s*(.+?)\\]");
    expect(state?.flags).toBe("gs");

    // strip:true removes the tag from the passage, which a converter must reproduce or lose it.
    expect(items?.strip).toBe(true);
    expect(items?.placement).toEqual(["ai_output"]);
  });

  test("reads every action type, since each needs a different equivalent elsewhere", () => {
    const machine = readStateMachine(YAML);
    const types = machine.hooks.flatMap((hook) => hook.actions.map((a) => a.type));
    expect(new Set(types)).toEqual(new Set(["set", "unset", "append", "push"]));
  });

  test("counts dashboard rows and the gated ones separately", () => {
    // A gated row cannot be honoured by an engine with no conditionals, so it is counted apart.
    const machine = readStateMachine(YAML);
    expect(machine.dashboardRows).toBe(2);
    expect(machine.dashboardConditionalRows).toBe(1);
  });

  test("an absent state layer is empty, not an error", () => {
    for (const input of [undefined, null, "", "   ", 42, {}]) {
      const machine = readStateMachine(input);
      expect(machine.hooks).toEqual([]);
      expect(machine.dashboardRows).toBe(0);
    }
  });

  test("a malformed layer reports what it could not read instead of pretending", () => {
    const machine = readStateMachine("hooks:\n  - id: broken\n    nonsense-line-here\n");
    expect(machine.hooks).toHaveLength(1);
    expect(machine.unparsedLines).toBeGreaterThan(0);
  });
});

describe("variablesWritten", () => {
  test("maps each variable to the actions that write it", () => {
    const written = variablesWritten(readStateMachine(YAML));
    expect(written.get("staging_state_ledger")).toEqual(["set", "append"]);
    expect(written.get("staging_propp_plan")).toEqual(["unset", "push"]);
  });
});

describe("censusConditionals", () => {
  test("counts openers, closers and else branches", () => {
    const census = censusConditionals([
      "{{if {{.mode}}}}A{{else}}B{{/if}}",
      "{{if {{getvar::rank}} == 1}}C{{/if}}",
    ]);
    expect(census.openers).toBe(2);
    expect(census.closers).toBe(2);
    expect(census.elses).toBe(1);
  });

  test("reads condition variables through both getvar and the dot shorthand", () => {
    // The dot form is the majority in real presets and is invisible to a naive getvar scan.
    const census = censusConditionals(["{{if {{.mode}}}}x{{/if}}", "{{if {{getvar::mode}}}}y{{/if}}"]);
    expect(census.readsByVariable.get("mode")).toBe(2);
  });

  test("a nested condition is still seen", () => {
    // The opener carries its condition as a nested macro; a flat scan misses the opener entirely.
    const census = censusConditionals(["{{if {{getvar::deep}}}}x{{/if}}"]);
    expect(census.openers).toBe(1);
    expect(census.readsByVariable.get("deep")).toBe(1);
  });

  test("prose with no conditionals reports nothing", () => {
    const census = censusConditionals(["plain text {{char}}"]);
    expect(census.openers).toBe(0);
    expect(census.readsByVariable.size).toBe(0);
  });
});
