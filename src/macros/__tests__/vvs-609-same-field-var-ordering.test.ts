/**
 * VVS-609 — "getvar returns empty in same Scenario as setvar".
 *
 * Regression pins. The reporter (on the pre-rewrite macro parser,
 * ~v2.595) had dot-var assignments and switch/if reads in the SAME
 * Scenario field returning empty unless the reads were moved to a
 * later prompt (Author's Note). On the clean-room tokenizer
 * (parseNodesV2) every reported shape resolves correctly in a single
 * field, verified here at the engine level AND live through
 * /api/chat/preview-prompt (the assembled prompt renders the switch
 * result in the scenario slot). These tests pin same-field
 * set-then-read ordering so the parser can't regress to the reported
 * behavior:
 *  - literal setvar/getvar, and getvar nested in switch
 *  - dot-var sugar ({{.x = ...}} / {{.x}})
 *  - assignment from a nested macro ({{roll}}), then a switch read
 *  - the reporter's full multiline compound (roll -> switch with
 *    noop arms -> if/compare read)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { processMacros, initializeMacros, createDefaultContext } from "../index";

beforeAll(() => initializeMacros());

describe("vvs-609 repro", () => {
  it("switch sees a variable set earlier in the same text", () => {
    const ctx = createDefaultContext({});
    const result = processMacros(
      "{{setvar::mood::happy}}{{switch::{{getvar::mood}}::happy:MATCHED::NOMATCH}}",
      ctx,
    );
    expect(result.text).toBe("MATCHED");
  });

  it("dot-var assignment then dot-var read works in the same text", () => {
    const ctx = createDefaultContext({});
    const result = processMacros(
      "{{.mood = happy}}[{{.mood}}]",
      ctx,
    );
    expect(result.text).toBe("[happy]");
  });

  it("switch over a dot-var assigned earlier in the same text (reporter's exact shape)", () => {
    const ctx = createDefaultContext({});
    const result = processMacros(
      "{{.roll = 3}}{{.label = {{switch::{{.roll}}::1:One::2:Two::3:Three::Other}}}}[{{.label}}]",
      ctx,
    );
    expect(result.text).toBe("[Three]");
  });

  it("nested assignment from a macro then switch read (roll shape)", () => {
    const ctx = createDefaultContext({});
    const result = processMacros(
      "{{.r = {{roll::1d1}}}}{{switch::{{.r}}::1:ONE::NOTONE}}",
      ctx,
    );
    expect(result.text).toBe("ONE");
  });

  it("multiline scenario with roll, switch arms containing noop, and if/compare reads (full reporter shape)", () => {
    const ctx = createDefaultContext({});
    const text = [
      "{{.f1_roll = {{roll::1d1}}}}",
      "{{.f1 = {{switch::{{.f1_roll}}::1:Reputation::2:Flag::13:{{noop}}::Other}}}}",
      "{{.depth = 3}}",
      "{{.v2 = {{if::{{compare::{{.depth}}::>=::2}}::{{.f1}}}}}}",
      "Result: [{{.v2}}]",
    ].join("\n");
    const result = processMacros(text, ctx);
    expect(result.text).toContain("Result: [Reputation]");
  });

  it("plain getvar sees a variable set earlier in the same text", () => {
    const ctx = createDefaultContext({});
    const result = processMacros(
      "{{setvar::mood::happy}}[{{getvar::mood}}]",
      ctx,
    );
    expect(result.text).toBe("[happy]");
  });
});
