/**
 * P2: the RC compiler port's contract. Golden shape mirrors generatePersonaXml's own doc example;
 * the XML-preservation and escaping cases port RC's tested behaviors. brief NEVER appears in
 * output - the family landmine, pinned here forever.
 */
import { describe, expect, test } from "bun:test";
import type { PersonaBody } from "../../entities/persona/schema";
import { compileSections, escapeXml, injectPersonaXml, toXmlTagName } from "./inject";

const luna: PersonaBody = {
  name: "Luna Nightwhisper",
  brief: "A short library blurb that must NEVER be injected.",
  content: "",
  sections: {
    appearance: "Slender and graceful, moves like moonlight.",
    personality: "Mysteriously calm.\n\n\nCollects secrets.",
    quirks: "Traces constellations in the air.",
    history: "A wanderer from the twilight realms.",
  },
  traits: ["Mysterious", "Ethereal", "Wise"],
  identity: { pronouns: "she/her", tagline: "Queen of Aridia", height: "5'7\"", age: "Eternal" },
  presentation: {
    colors: [
      { label: "Skin", name: "Lavender", hex: "#E8D5FF" },
      { label: "Hair", name: "Silver", hex: "#C0C0C0" },
    ],
  },
};

describe("injectPersonaXml (the RC port)", () => {
  test("golden shape: identity first, colors as labeled tags, flat sections in order", () => {
    const xml = injectPersonaXml(luna);
    expect(xml).toBe(
      [
        '<persona name="Luna Nightwhisper">',
        "  <identity>",
        "    <pronouns>she/her</pronouns>",
        "    <title>Queen of Aridia</title>",
        "    <height>5&apos;7&quot;</height>",
        "    <age>Eternal</age>",
        "  </identity>",
        "  <skin>Lavender (#E8D5FF)</skin>",
        "  <hair>Silver (#C0C0C0)</hair>",
        "  <appearance>Slender and graceful, moves like moonlight.</appearance>",
        "  <personality>Mysteriously calm.\nCollects secrets.</personality>",
        "  <traits>Mysterious, Ethereal, Wise</traits>",
        "  <quirks>Traces constellations in the air.</quirks>",
        "  <history>A wanderer from the twilight realms.</history>",
        "</persona>",
      ].join("\n"),
    );
  });

  test("brief NEVER enters the output (the family landmine)", () => {
    expect(injectPersonaXml(luna)).not.toContain("library blurb");
  });

  test("the pronoun TRIPLET compiles when free-text pronouns are absent", () => {
    const p: PersonaBody = {
      name: "T",
      content: "",
      identity: { pronounSet: { subjective: "she", objective: "her", possessive: "hers" } },
    };
    expect(injectPersonaXml(p)).toContain("<pronouns>she/her/hers</pronouns>");
  });

  test("sectionOrder is honored and body folds into appearance", () => {
    const p: PersonaBody = {
      name: "T",
      content: "",
      sections: { appearance: "Tall.", body: "Broad shoulders.", quirks: "Hums." },
      sectionOrder: ["quirks", "appearance"],
    };
    const xml = injectPersonaXml(p);
    expect(xml.indexOf("<quirks>")).toBeLessThan(xml.indexOf("<appearance>"));
    expect(xml).toContain("<appearance>Tall.\nBroad shoulders.</appearance>");
  });

  test("flat content rides as body text when no sections exist; wrapper prepends", () => {
    const p: PersonaBody = {
      name: "Chi",
      content: "A grumpy senior with taste.",
      chatInjection: { position: "character", wrapper: "This is {{user}}'s identity:" },
    };
    const xml = injectPersonaXml(p);
    expect(xml.startsWith("This is {{user}}'s identity:\n<persona name=\"Chi\">")).toBe(true);
    expect(xml).toContain("  A grumpy senior with taste.");
  });

  test("user-authored XML tags are preserved while the rest escapes (RC behavior)", () => {
    const p: PersonaBody = {
      name: "T",
      content: "Wears a <scar side=\"left\"/> mark & says 1 < 2 often.",
    };
    const xml = injectPersonaXml(p);
    expect(xml).toContain('<scar side="left"/>');
    expect(xml).toContain("&amp; says 1 &lt; 2");
  });

  test("output is deterministic (same input, same bytes)", () => {
    expect(injectPersonaXml(luna)).toBe(injectPersonaXml(luna));
  });
});

describe("helpers", () => {
  test("toXmlTagName ports RC's normalization", () => {
    expect(toXmlTagName("Skin Tone")).toBe("skin_tone");
    expect(toXmlTagName("Eyes!!")).toBe("eyes");
    expect(toXmlTagName("  ")).toBe("");
  });

  test("escapeXml keeps existing entities intact", () => {
    expect(escapeXml("Tom &amp; Jerry & Spike")).toBe("Tom &amp; Jerry &amp; Spike");
  });

  test("compileSections joins in order with blank lines, skipping empties", () => {
    const p: PersonaBody = {
      name: "T",
      content: "",
      sections: { appearance: "Tall.", personality: "", history: "Old soldier." },
      sectionOrder: ["history", "appearance", "personality"],
    };
    expect(compileSections(p)).toBe("Old soldier.\n\nTall.");
  });
});
