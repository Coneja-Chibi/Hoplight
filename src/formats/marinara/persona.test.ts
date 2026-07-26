/** Marinara persona codec (P5): sections map, theming/stats/crop ride SEALED and re-emit. */
import { describe, expect, test } from "bun:test";
import adapter from "./persona";

const wire = () => ({
  id: "mp1",
  name: "Ada",
  comment: "Purple menace in a suit.",
  description: "Blunt, loyal, underpaid.",
  personality: "Coiled confidence.",
  scenario: "Runs the studio.",
  backstory: "Grew up on deadlines.",
  appearance: "Compact hourglass.",
  avatarPath: "/img/ada.png",
  avatarCrop: { srcX: 0, srcY: 0, srcWidth: 512, srcHeight: 512 },
  isActive: true,
  nameColor: "#a78bfa",
  dialogueColor: "#d168f8",
  boxColor: "#17161d",
  personaStats: { enabled: true, bars: [{ name: "Energy", value: 40, max: 100, color: "#f2b235" }] },
  tags: ["main"],
  savedStatusOptions: ["working"],
  createdAt: "2026-07-01",
  updatedAt: "2026-07-12",
});

describe("detection", () => {
  test("claims the sectioned+themed object at 0.95; refuses Lumi/plain shapes", () => {
    expect(adapter.detect({ text: JSON.stringify(wire()) })).toBe(0.95);
    expect(
      adapter.detect({
        text: JSON.stringify({ id: "x", name: "X", description: "d", subjective_pronoun: "she", objective_pronoun: "her" }),
      }),
    ).toBe(0);
    expect(adapter.detect({ text: JSON.stringify({ id: "x", name: "X" }) })).toBe(0);
  });
});

describe("round trip", () => {
  test("brief/sections map in; theming, stats, crop, scenario seal and re-emit byte-true", () => {
    const e = adapter.toCanonical({ text: JSON.stringify(wire()) });
    expect(e.body.brief).toBe("Purple menace in a suit.");
    expect(e.body.content).toBe("Blunt, loyal, underpaid.");
    expect(e.body.sections).toEqual({
      appearance: "Compact hourglass.",
      personality: "Coiled confidence.",
      history: "Grew up on deadlines.",
    });
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof wire>;
    expect(out).toEqual(wire());
  });

  test("clearing a section to empty is honored, not reverted to the sealed twin", () => {
    // Re-verification of a codec-read finding: the section editor sends "" for a cleared field, never
    // undefined, so "" short-circuits the `?? str(base.X)` twin fallback and the clear survives export.
    const e = adapter.toCanonical({ text: JSON.stringify(wire()) });
    e.body.sections = { ...e.body.sections, personality: "" };
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof wire>;
    expect(out.personality).toBe("");
  });

  test("the brief-vs-content never-swap holds through the wire", () => {
    const e = adapter.toCanonical({ text: JSON.stringify(wire()) });
    e.body.brief = "New blurb.";
    e.body.content = "New identity text.";
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "") as ReturnType<typeof wire>;
    expect(out.comment).toBe("New blurb.");
    expect(out.description).toBe("New identity text.");
  });

  // The smallest wire readMarinaraPersona accepts: id + name + string description + string personality
  // + one theming key. comment/appearance/backstory/avatarPath are all absent. Unedited round-trip must
  // not fabricate them (the Round-Trip Law: fromCanonical invents nothing the source lacked).
  const minimal = () => ({
    id: "mp-min",
    name: "User",
    description: "Just me.",
    personality: "Wry and tired.",
    boxColor: "#101010",
  });

  test("minimal object round-trips byte-true: no fabricated comment/appearance/backstory/avatarPath", () => {
    const src = minimal();
    const e = adapter.toCanonical({ text: JSON.stringify(src) });
    const out = JSON.parse(adapter.fromCanonical(e).text ?? "");
    expect(out).toEqual(src);
  });

  test("a from-scratch canonical persona emits a wire object this adapter can read", () => {
    const output = adapter.fromCanonical({
      schemaVersion: "1",
      kind: "persona",
      id: "fresh",
      body: { name: "Fresh", content: "" },
    });
    const wire = JSON.parse(output.text ?? "");

    expect(wire).toEqual({
      id: "fresh",
      name: "Fresh",
      description: "",
      personality: "",
      personaStats: { enabled: false, bars: [] },
    });
    expect(adapter.detect(output)).toBe(0.95);
    expect(adapter.toCanonical(output).body.name).toBe("Fresh");
  });
});
