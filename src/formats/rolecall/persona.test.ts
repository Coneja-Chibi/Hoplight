import { test, expect } from "bun:test";
import adapter, { unfoldDescription, compileSections } from "./persona";
import { characterAdapter as rcCharacter } from "./index";
import { characterAdapter as stCharacter } from "../sillytavern/index";

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

/** Shape 1: rcpersona native envelope, full sections + metadata, empty content (compile rule fires). */
function rcpersonaFullSections() {
  return {
    spec: "rolecall_persona",
    spec_version: "1.0",
    data: {
      name: "Ada",
      description: "A short library blurb.",
      content: "",
      sections: {
        appearance: "Tall, ink-stained fingers.",
        personality: "Curious, stubborn.",
        history: "Grew up around presses.",
      },
      metadata: {
        creator: "ada",
        version: "1.2",
        created_at: "2026-01-19T00:00:00Z",
        tags: ["fantasy", "adventurer"],
        content_rating: "after_dark",
        source: "rolecall",
      },
    },
  };
}

/** Shape 2: the RC production V2-card persona export (extensions.rolecall.type === "persona"). */
function rcV2Export() {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: "Ada",
      description: "I am the user's voice.\n\nAppearance: Tall and wiry.\n\nBody: Scarred hands.",
      personality: "Curious, stubborn.",
      scenario: "Grew up around presses.",
      creator_notes: "A short library blurb.",
      first_mes: "",
      mes_example: "",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      tags: ["curious", "stubborn"],
      extensions: {
        rolecall: {
          id: "uuid-p1",
          type: "persona",
          tagline: "the one holding the pen",
          age: "27",
          height: "6'1\"",
          pronouns: "he/him",
          quirks: "Hums while thinking.",
          signature_color: "#7a5c3a",
          colors: [{ hex: "#1a1410", name: "ink", label: "Ink" }],
          lorebook_id: "lb-9",
          section_order: ["personality", "appearance", "history", "body", "quirks"],
          image_url: "https://cdn/p.png",
          is_after_dark: true,
          source: "rolecall",
        },
      },
    },
  };
}

// -- detection + the cross-kind firewall ------------------------------------------------------------

test("detect claims both RC persona shapes at 1.0 and rejects character cards", () => {
  expect(adapter.detect(asText(rcpersonaFullSections()))).toBe(1);
  expect(adapter.detect(asText(rcV2Export()))).toBe(1);
  // a normal RC CHARACTER card is not a persona
  expect(adapter.detect(asText({ spec: "chara_card_v2", data: { name: "x", extensions: { rolecall: { id: "c1" } } } }))).toBe(0);
  expect(adapter.detect({ text: "not json" })).toBe(0);
});

test("FIREWALL: the RC character adapter steps aside for a persona-type card (no 1.0 tie)", () => {
  expect(rcCharacter.detect(asText(rcV2Export()))).toBe(0);
  // and the generic ST reader stays at its usual 0.9, below the persona codec's 1.0
  expect(stCharacter.detect(asText(rcV2Export()))).toBe(0.9);
  expect(adapter.detect(asText(rcV2Export()))).toBe(1);
});

// -- shape 1: rcpersona -----------------------------------------------------------------------------

test("rcpersona: sections compile to content in fixed order when content is empty", () => {
  const ent = adapter.toCanonical(asText(rcpersonaFullSections()));
  expect(ent.body.name).toBe("Ada");
  expect(ent.body.brief).toBe("A short library blurb."); // description = the BRIEF, never content
  expect(ent.body.content).toBe(
    "Appearance: Tall, ink-stained fingers.\n\nPersonality: Curious, stubborn.\n\nHistory: Grew up around presses.",
  );
  expect(ent.body.sections?.appearance).toBe("Tall, ink-stained fingers.");
  expect(ent.body.rating).toBe("explicit"); // after_dark
  expect(ent.body.attribution).toEqual({
    creator: "ada",
    version: "1.2",
    createdAt: "2026-01-19T00:00:00Z",
    source: "rolecall",
  });
});

test("rcpersona: non-empty content WINS outright over sections (never merged twice)", () => {
  const src = rcpersonaFullSections();
  src.data.content = "I speak for myself.";
  const ent = adapter.toCanonical(asText(src));
  expect(ent.body.content).toBe("I speak for myself.");
  expect(ent.body.sections?.personality).toBe("Curious, stubborn."); // canonical keeps BOTH
});

test("rcpersona: unedited round-trip deep-equals; metadata.tags residue rides the twin", () => {
  const src = rcpersonaFullSections();
  src.data.content = "I speak for myself.";
  const ent = adapter.toCanonical(asText(src));
  expect(JSON.parse(adapter.fromCanonical(ent).text ?? "")).toEqual(src);
});

test("rcpersona edit: mutating brief/content/rating reaches the wire", () => {
  const src = rcpersonaFullSections();
  src.data.content = "I speak for myself.";
  const ent = adapter.toCanonical(asText(src));
  ent.body.brief = "New blurb.";
  ent.body.content = "Rewritten voice.";
  ent.body.rating = "all-ages";
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  expect(out.data.description).toBe("New blurb.");
  expect(out.data.content).toBe("Rewritten voice.");
  expect(out.data.metadata.content_rating).toBe("all_hours");
  expect(out.data.metadata.tags).toEqual(["fantasy", "adventurer"]); // original residue survives
});

// -- shape 2: RC V2-export --------------------------------------------------------------------------

test("rc-v2-export: full field map lands, description unfolds, brief/content never swap", () => {
  const ent = adapter.toCanonical(asText(rcV2Export()));
  const b = ent.body;
  expect(b.brief).toBe("A short library blurb."); // creator_notes -> brief
  expect(b.content).toBe("I am the user's voice."); // unfolded
  expect(b.sections).toEqual({
    appearance: "Tall and wiry.",
    body: "Scarred hands.",
    personality: "Curious, stubborn.",
    history: "Grew up around presses.",
    quirks: "Hums while thinking.",
  });
  expect(b.sectionOrder).toEqual(["personality", "appearance", "history", "body", "quirks"]);
  expect(b.traits).toEqual(["curious", "stubborn"]);
  expect(b.identity).toEqual({ tagline: "the one holding the pen", age: "27", height: "6'1\"", pronouns: "he/him" });
  expect(b.presentation?.signatureColor).toBe("#7a5c3a");
  expect(b.presentation?.imageUrl).toBe("https://cdn/p.png");
  expect(b.knowledgeRefs).toEqual(["lb-9"]);
  expect(b.rating).toBe("explicit");
});

test("rc-v2-export: unedited round-trip deep-equals (id/type/source bookkeeping rides the twin)", () => {
  const src = rcV2Export();
  const ent = adapter.toCanonical(asText(src));
  expect(JSON.parse(adapter.fromCanonical(ent).text ?? "")).toEqual(src);
});

test("rc-v2-export edit: section + identity edits re-fold into their exact wire homes", () => {
  const ent = adapter.toCanonical(asText(rcV2Export()));
  ent.body.sections!.appearance = "Short and broad.";
  ent.body.identity!.age = "28";
  ent.body.rating = "all-ages";
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  expect(out.data.description).toBe("I am the user's voice.\n\nAppearance: Short and broad.\n\nBody: Scarred hands.");
  const rc = out.data.extensions.rolecall;
  expect(rc.age).toBe("28");
  expect("is_after_dark" in rc).toBe(false); // omitted-not-false wire habit
  expect(rc.id).toBe("uuid-p1"); // bookkeeping untouched
  expect(rc.type).toBe("persona");
});

test("cross-shape: an rc-v2-export persona re-emits as native rcpersona when its twin is absent", () => {
  const ent = adapter.toCanonical(asText(rcV2Export()));
  delete ent.original; // simulate a cross-format/authored entity with no twin
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  expect(out.spec).toBe("rolecall_persona");
  expect(out.data.name).toBe("Ada");
  expect(out.data.description).toBe("A short library blurb.");
  expect(out.data.content).toBe("I am the user's voice.");
});

// -- wrappers + failure modes -----------------------------------------------------------------------

test("legacy library-export wrapper unwraps OUTER-first (the Discord-ticket regression)", () => {
  const wrapped = { exportedAt: "2026-01-01", type: "persona", version: 1, data: { persona: rcpersonaFullSections() } };
  expect(adapter.detect(asText(wrapped))).toBe(1);
  const ent = adapter.toCanonical(asText(wrapped));
  expect(ent.body.name).toBe("Ada");
});

test("missing name fails the parse - never synthesized", () => {
  const src = rcpersonaFullSections();
  (src.data as { name?: string }).name = "";
  expect(() => adapter.toCanonical(asText(src))).toThrow(/no name/);
});

// -- unit properties --------------------------------------------------------------------------------

test("compileSections order is fixed regardless of object key order", () => {
  expect(compileSections({ history: "h", appearance: "a" })).toBe("Appearance: a\n\nHistory: h");
});

test("unfoldDescription is a no-op on text without Appearance:/Body: paragraphs", () => {
  const text = "Just some persona text.\n\nWith two paragraphs.";
  expect(unfoldDescription(text)).toEqual({ content: text, appearance: undefined, body: undefined });
});
