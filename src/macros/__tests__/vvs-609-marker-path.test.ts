/**
 * VVS-609 regression: dot-vars nested in {{switch}}/{{if}} inside a character
 * card field must resolve when that field reaches the prompt via the
 * {{scenario}} MARKER path (preset scenario slot / card-field expansion), not
 * only when the same text is processed at the top level.
 *
 * This lives at the MARKER path on purpose: earlier "fixes" green-lied because
 * they called processMacros(cardText) directly, which preprocesses sugar at the
 * top level. The real card text arrives as a macro's EXPANSION ({{scenario}} ->
 * field value), which the engine re-parses. The bug was that re-parse skipped
 * sugar normalization, so dot-vars used as a {{switch}} scrutinee never
 * canonicalized and silently failed. A pin that goes through {{scenario}} cannot
 * hide behind top-level preprocessing.
 */
import { beforeAll, describe, it, expect } from "vitest";
import { processMacros, initializeMacros, createDefaultContext } from "../index";

beforeAll(() => initializeMacros());

// Run text either directly (chat / Author's Note path) or via the {{scenario}}
// marker (the card-field path his card actually takes).
const viaMarker = (scenario: string): string => {
  const ctx = createDefaultContext({ scenario } as never);
  return processMacros("{{scenario}}", ctx).text;
};
const direct = (text: string): string => processMacros(text, createDefaultContext({})).text;

// A dot-var read as a {{switch}} scrutinee, deterministic (cuma = 3 -> Knight).
const DOT_SWITCH =
  "{{.cuma = 3}}\ncuma: {{.cuma}}\nPosition: {{switch::{{.cuma}}::1:Royal::2:Noble::3:Knight::4:Merchant::5:Scholar::6:Mage}}";

// murkapie's deepest real shape: switch nested INSIDE a dot-assignment, then a
// chained dot-read of that switch-set var inside an {{if}} inside another
// dot-assignment (v2 reads f1).
const COMPOUND =
  "{{.roll = 3}}\n" +
  "{{.f1 = {{switch::{{.roll}}::1:Royal::2:Noble::3:Knight::4:Merchant::5:{{noop}}::6:Mage}}}}" +
  "\nEcho f1: {{.f1}}\n" +
  "{{.check = 5}}\n" +
  "{{.v2 = {{if::{{compare::{{.check}}::>::3}}::{{.f1}} the Bold::commoner}}}}" +
  "\nEcho v2: {{.v2}}";

describe("VVS-609 marker path: dot-vars in switch/if resolve through {{scenario}}", () => {
  it("baseline: resolves at the top level (the path that already worked)", () => {
    expect(direct(DOT_SWITCH)).toContain("Position: Knight");
  });

  it("resolves through the {{scenario}} marker (the reported failing path)", () => {
    const out = viaMarker(DOT_SWITCH);
    expect(out).toContain("cuma: 3");
    expect(out).toContain("Position: Knight");
  });

  it("resolves murkapie's compound shape (switch-in-assignment + chained read) via marker", () => {
    const out = viaMarker(COMPOUND);
    expect(out).toContain("Echo f1: Knight");
    expect(out).toContain("Echo v2: Knight the Bold");
  });

  it("a bare dot-read still resolves through the marker", () => {
    expect(viaMarker("cuma: {{.cuma = 3}}{{.cuma}}")).toBe("cuma: 3");
  });
});
