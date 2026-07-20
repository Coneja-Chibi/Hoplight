/** Regression coverage for the rolecall.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import { characterAdapter as adapter } from "./index";
import { characterAdapter as sillytavern } from "../sillytavern/index";

/** A realistic RC CCv3 export: standard data + sprites-as-assets + the full extensions.rolecall block. */
function makeRcCard() {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Vera",
      description: "A wandering cartographer.",
      personality: "curious, dry",
      scenario: "at a crossroads inn",
      first_mes: "You again.",
      mes_example: "<START>",
      system_prompt: "",
      post_history_instructions: "",
      creator_notes: "handle with care",
      alternate_greetings: ["Oh. It's you.", "Lost again?"],
      group_only_greetings: [],
      tags: ["adventure", "oc"],
      creator: "ada",
      character_version: "2.1",
      source: ["rolecall:abc"],
      creation_date: 1700000000,
      modification_date: 1700000500,
      assets: [
        { type: "icon", uri: "https://cdn/main.png", name: "main", ext: "png" },
        { type: "emotion", uri: "https://cdn/happy.png", name: "happy", ext: "png" },
      ],
      extensions: {
        depth_prompt: { prompt: "stay in character", depth: 4 },
        rolecall: {
          id: "uuid-1",
          tagline: "the map knows the way",
          genre: "adventure",
          fandom: "original",
          nsfw: false,
          content_rating: "late_night",
          token_count: 512,
          source_url: "https://rolecall.app/c/vera",
          accent_color: "#3a2e1f",
          creators_note: "my favorite",
          alternate_greeting_titles: ["Reunion", null],
          details: {
            signature_color: "#7a5c3a",
            gradient_colors: ["#3a2e1f", "#7a5c3a"],
            colors: [{ label: "Ink", name: "ink", hex: "#1a1410" }],
            fieldOrder: ["personality", "scenario"],
            default_background: { backgroundId: null, customUrl: "https://cdn/bg.mp4", overlayOpacity: 0.6, videoPlaybackRate: 1 },
            prompt_depth_injections: [{ id: "d1", content: "remember the map", depth: 3, role: "system", enabled: true }],
            publicDefinitionDisplay: { spoilerMode: true, order: ["description"], spoilers: { description: true } },
          },
        },
      },
    },
  };
}

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

test("detect claims an RC card (1.0) and ignores a plain CCv3 card and junk", () => {
  expect(adapter.detect(asText(makeRcCard()))).toBe(1);
  // a CCv3 card with no rolecall block is not ours
  expect(adapter.detect(asText({ spec: "chara_card_v3", data: { name: "x", extensions: {} } }))).toBe(0);
  expect(adapter.detect({ text: "not json" })).toBe(0);
});

test("detect works on a real .json read, which carries BOTH bytes and decoded text", () => {
  const text = JSON.stringify(makeRcCard());
  const bytes = new TextEncoder().encode(text);
  // the CLI passes bytes AND text for a .json file; the non-PNG bytes must not swallow the text
  expect(adapter.detect({ bytes, text })).toBe(1);
});

test("toCanonical maps the RC-specific layer onto the shared Tavern body", () => {
  const ent = adapter.toCanonical(asText(makeRcCard()));
  expect(ent.id).toBe("vera");
  expect(ent.body.identity.name).toBe("Vera");
  expect(ent.body.identity.tagline).toBe("the map knows the way");
  expect(ent.body.discovery.rating).toBe("mature"); // late_night
  expect(ent.body.discovery.genre).toBe("adventure");
  expect(ent.body.attribution.sourceUrl).toBe("https://rolecall.app/c/vera");

  // parallel titles zip into Greeting objects; the untitled one carries no title
  expect(ent.body.greetings.alternateGreetings).toEqual([
    { text: "Oh. It's you.", title: "Reunion" },
    { text: "Lost again?" },
  ]);

  // details injections CONCAT with the shared-path depth_prompt entry (the old replace clobbered it)
  expect(ent.body.prompts.depthInjections).toEqual([
    { text: "remember the map", depth: 3, role: "system", enabled: true, origin: "rolecall_details" },
    { text: "stay in character", depth: 4, origin: "depth_prompt" },
  ]);

  const p = ent.body.presentation!;
  // accent_color is account-level, not a card field: it is intentionally NOT surfaced on presentation.
  // It is still kept whole in the original and re-emitted on export (proven by the round-trip test).
  expect(p.palette).toEqual([{ label: "Ink", name: "ink", hex: "#1a1410" }]);
  expect(p.background).toEqual({ ref: "https://cdn/bg.mp4", overlayOpacity: 0.6, videoPlaybackRate: 1 });
  expect(p.fieldOrder).toEqual(["personality", "scenario"]);
  // the authored per-field spoiler map is first-class now (was collapsed to mode/order and lost)
  expect(p.spoilers).toEqual({ mode: "on", order: ["description"], fields: { description: true } });

  // sprites serialized into data.assets[] become the media/expression pack
  expect(ent.body.media.portrait).toEqual({ role: "portrait", label: "main", ref: "https://cdn/main.png", mime: "image/png", primary: true });
  expect(ent.body.media.assets).toEqual([{ role: "emotion", label: "happy", ref: "https://cdn/happy.png", mime: "image/png" }]);
});

test("round-trip is lossless: an RC card deep-equals through canonical + back", () => {
  const original = makeRcCard();
  const ent = adapter.toCanonical(asText(original));
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  expect(JSON.parse(out.text!)).toEqual(original);
});

test("canonical model bridges RoleCall -> SillyTavern (rolecall layer drops, standard fields survive)", () => {
  const ent = adapter.toCanonical(asText(makeRcCard()));
  const st = sillytavern.fromCanonical(ent);
  const card = JSON.parse(st.text!);
  // Portable media forces a CCv3 envelope (V2 has no assets[] contract).
  expect(card.spec).toBe("chara_card_v3");
  expect(card.data.name).toBe("Vera");
  expect(card.data.first_mes).toBe("You again.");
  expect(card.data.scenario).toBe("at a crossroads inn");
  // greeting titles flatten to plain strings for a format that has no titles
  expect(card.data.alternate_greetings).toEqual(["Oh. It's you.", "Lost again?"]);
  // no RC extension leaks into the ST card
  expect(card.data.extensions?.rolecall).toBeUndefined();
  // representable media projects into ST assets with emotion (not RC expression)
  expect(card.data.assets).toContainEqual({
    type: "icon",
    name: "main",
    uri: "https://cdn/main.png",
    ext: "png",
  });
  expect(card.data.assets).toContainEqual({
    type: "emotion",
    name: "happy",
    uri: "https://cdn/happy.png",
    ext: "png",
  });
});

// -- Real-corpus wiring-bug regressions (samples/rolecall/characters/vera-casting-card.v3.json). The in-suite
// fixture had LIED about the asset type (used "emotion" where real RC emits "expression"), which is
// exactly how the role misrouting hid. These tests run on the real serializer shapes. --

import { readFileSync } from "node:fs";
import { join } from "node:path";

const realCard = readFileSync(
  join(import.meta.dir, "../../../samples/rolecall/characters/vera-casting-card.v3.json"),
  "utf8",
);

test("WB-1: real RC expression sprites land role 'emotion', not 'other'", () => {
  const ent = adapter.toCanonical({ text: realCard });
  const roles = ent.body.media.assets?.map((a) => [a.label, a.role]);
  expect(roles).toContainEqual(["smile", "emotion"]);
  expect(roles).toContainEqual(["frown", "emotion"]);
  expect(ent.body.media.assets?.some((a) => a.role === "other")).toBe(false);
});

test("WB-2: depth_prompt and details injections COEXIST (concat, not clobber)", () => {
  const ent = adapter.toCanonical({ text: realCard });
  const inj = ent.body.prompts.depthInjections!;
  // details first (2 entries), then the shared-path depth_prompt entry
  expect(inj.map((i) => i.origin)).toEqual(["rolecall_details", "rolecall_details", "depth_prompt"]);
  expect(inj.at(-1)!.text).toBe("stay in character as Vera");
});

test("WB-2 edit: editing the depth_prompt-origin entry reaches extensions.depth_prompt on export", () => {
  const ent = adapter.toCanonical({ text: realCard });
  const dp = ent.body.prompts.depthInjections!.find((i) => i.origin === "depth_prompt")!;
  dp.text = "always the cartographer";
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  expect(out.data.extensions.depth_prompt.prompt).toBe("always the cartographer");
  // the details injections' home is untouched
  expect(out.data.extensions.rolecall.details.prompt_depth_injections).toHaveLength(2);
});

test("real RC card round-trips unedited without wire mutation", () => {
  const ent = adapter.toCanonical({ text: realCard });
  expect(JSON.parse(adapter.fromCanonical(ent).text ?? "")).toEqual(JSON.parse(realCard));
});

// -- De-original (real sample): authored casting-card fields land in first-class slots + edits reach wire --

test("de-original read: identity attrs / signatureColor / spoiler fields / publicNote / mediaLinks", () => {
  const ent = adapter.toCanonical({ text: realCard });
  expect(ent.body.identity.fullName).toBe("Veranika Sandoval");
  expect(ent.body.identity.title).toBe("The Wandering Cartographer");
  expect(ent.body.identity.age).toBe("34");
  expect(ent.body.identity.pronouns).toBe("she/her");
  expect(ent.body.presentation?.signatureColor).toBe("#7a5c3a");
  expect(ent.body.presentation?.spoilers?.fields).toBeDefined();
  expect(ent.body.attribution.publicNote).toBe("She's the first character I ever finished. Be kind to her.");
  expect(ent.body.presentation?.mediaLinks).toBeDefined();
});

test("de-original edit: mutating the new RC slots reaches their exact wire homes", () => {
  const ent = adapter.toCanonical({ text: realCard });
  ent.body.identity.title = "Master Cartographer";
  ent.body.identity.age = "35";
  ent.body.presentation!.signatureColor = "#123456";
  ent.body.attribution.publicNote = "Updated note.";
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  const rc = out.data.extensions.rolecall;
  expect(rc.details.title).toBe("Master Cartographer");
  expect(rc.details.age).toBe("35");
  expect(rc.details.signature_color).toBe("#123456");
  expect(rc.creators_note).toBe("Updated note.");
  // untouched neighbors survive
  expect(rc.details.full_name).toBe("Veranika Sandoval");
  expect(rc.details.pronouns).toBe("she/her");
});

// --- Clear intent: mapped tavern fields cleared must not resurrect from the twin ---

test("clear export: cleared description/scenario/tags do not resurrect from twin", () => {
  const ent = adapter.toCanonical({ text: realCard });
  delete (ent.body.identity as { description?: string }).description;
  delete (ent.body.persona as { scenario?: string }).scenario;
  delete (ent.body.persona as { personality?: string }).personality;
  delete (ent.body.greetings as { firstMessage?: string }).firstMessage;
  delete (ent.body.discovery as { tags?: string[] }).tags;
  delete (ent.body.greetings as { alternateGreetings?: unknown }).alternateGreetings;
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  expect(out.data.description).toBe("");
  expect(out.data.scenario).toBe("");
  expect(out.data.personality).toBe("");
  expect(out.data.first_mes).toBe("");
  expect(out.data.tags).toEqual([]);
  expect(out.data.alternate_greetings).toEqual([]);
  // RC extension residue still rides
  expect(out.data.extensions.rolecall).toBeDefined();
});

// --- Plan 010: presentation write-back (gradient, palette, background, fieldOrder) ---

test("presentation edit: gradient/palette/fieldOrder/background reach exact wire homes", () => {
  const ent = adapter.toCanonical({ text: realCard });
  ent.body.presentation!.gradientColors = ["#111111", "#222222"];
  ent.body.presentation!.palette = [{ label: "Ink", name: "ink", hex: "#000001" }];
  ent.body.presentation!.fieldOrder = ["description", "personality"];
  ent.body.presentation!.background = {
    ref: "https://cdn/new-bg.png",
    overlayOpacity: 0.3,
    videoPlaybackRate: 1.5,
  };
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  const d = out.data.extensions.rolecall.details;
  expect(d.gradient_colors).toEqual(["#111111", "#222222"]);
  expect(d.colors).toEqual([{ label: "Ink", name: "ink", hex: "#000001" }]);
  expect(d.fieldOrder).toEqual(["description", "personality"]);
  expect(d.default_background.customUrl).toBe("https://cdn/new-bg.png");
  expect(d.default_background.overlayOpacity).toBe(0.3);
  expect(d.default_background.videoPlaybackRate).toBe(1.5);
  // signatureColor still works; neighbors survive
  expect(d.signature_color).toBe("#7a5c3a");
  expect(d.full_name).toBe("Veranika Sandoval");
});

test("presentation clear: each of the four fields removes only its wire home", () => {
  const ent = adapter.toCanonical({ text: realCard });
  delete ent.body.presentation!.gradientColors;
  delete ent.body.presentation!.palette;
  delete ent.body.presentation!.fieldOrder;
  delete ent.body.presentation!.background;
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  const d = out.data.extensions.rolecall.details;
  expect("gradient_colors" in d).toBe(false);
  expect("colors" in d).toBe(false);
  expect("fieldOrder" in d).toBe(false);
  expect("default_background" in d).toBe(false);
  // signature and identity residue remain
  expect(d.signature_color).toBe("#7a5c3a");
  expect(d.full_name).toBe("Veranika Sandoval");
});

test("presentation from-scratch: each field independently creates details without extra defaults", () => {
  const base = {
    schemaVersion: 1 as const,
    kind: "character" as const,
    id: "solo",
    body: {
      identity: { name: "Solo" },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: {},
      attribution: {},
      discovery: {},
      presentation: { gradientColors: ["#abcabc"] },
    },
  };
  const out = JSON.parse(adapter.fromCanonical(base as never).text ?? "");
  const d = out.data.extensions.rolecall.details;
  expect(d.gradient_colors).toEqual(["#abcabc"]);
  expect(d.colors).toBeUndefined();
  expect(d.fieldOrder).toBeUndefined();
  expect(d.default_background).toBeUndefined();
});

test("presentation background: ID twin keeps backgroundId home; URL twin keeps customUrl", () => {
  const idCard = makeRcCard();
  (idCard.data.extensions.rolecall.details as { default_background: unknown }).default_background = {
    backgroundId: "rc-bg-42",
    customUrl: null,
    overlayOpacity: 0.4,
  };
  const entId = adapter.toCanonical(asText(idCard));
  expect(entId.body.presentation?.background?.ref).toBe("rc-bg-42");
  entId.body.presentation!.background = { ref: "rc-bg-99", overlayOpacity: 0.8 };
  const outId = JSON.parse(adapter.fromCanonical(entId).text ?? "");
  expect(outId.data.extensions.rolecall.details.default_background).toEqual({
    backgroundId: "rc-bg-99",
    customUrl: null,
    overlayOpacity: 0.8,
  });

  const entUrl = adapter.toCanonical(asText(makeRcCard()));
  entUrl.body.presentation!.background = { ref: "https://cdn/other.mp4", overlayOpacity: 0.1, videoPlaybackRate: 2 };
  const outUrl = JSON.parse(adapter.fromCanonical(entUrl).text ?? "");
  const bg = outUrl.data.extensions.rolecall.details.default_background;
  expect(bg.customUrl).toBe("https://cdn/other.mp4");
  expect(bg.backgroundId).toBeNull();
  expect(bg.overlayOpacity).toBe(0.1);
  expect(bg.videoPlaybackRate).toBe(2);
});

test("presentation palette unknown siblings survive hex edit; editing one field leaves neighbors", () => {
  const card = makeRcCard();
  (card.data.extensions.rolecall.details.colors as Array<Record<string, unknown>>)[0] = {
    label: "Ink",
    name: "ink",
    hex: "#1a1410",
    extra: "keep-me",
  };
  const ent = adapter.toCanonical(asText(card));
  ent.body.presentation!.palette = [{ label: "Ink", name: "ink", hex: "#ffffff" }];
  // only touch palette; gradient stays as imported
  const out = JSON.parse(adapter.fromCanonical(ent).text ?? "");
  const d = out.data.extensions.rolecall.details;
  expect(d.colors).toEqual([{ label: "Ink", name: "ink", hex: "#ffffff", extra: "keep-me" }]);
  expect(d.gradient_colors).toEqual(["#3a2e1f", "#7a5c3a"]);
  expect(d.fieldOrder).toEqual(["personality", "scenario"]);
});

test("presentation unedited real card still deep-equals (signature already written)", () => {
  const ent = adapter.toCanonical({ text: realCard });
  expect(JSON.parse(adapter.fromCanonical(ent).text ?? "")).toEqual(JSON.parse(realCard));
});

test("from-scratch emotion media writes type expression on RoleCall", () => {
  const ent = adapter.toCanonical(asText(makeRcCard()));
  // force new media set
  ent.body.media = {
    portrait: {
      role: "portrait",
      label: "main",
      ref: "https://cdn/face.png",
      mime: "image/png",
      primary: true,
    },
    assets: [
      { role: "emotion", label: "calm", ref: "https://cdn/calm.png", mime: "image/png" },
    ],
  };
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out.data.assets.find((a: { name: string }) => a.name === "main")?.type).toBe("icon");
  expect(out.data.assets.find((a: { name: string }) => a.name === "calm")).toEqual({
    type: "expression",
    name: "calm",
    uri: "https://cdn/calm.png",
    ext: "png",
  });
});
