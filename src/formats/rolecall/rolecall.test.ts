import { test, expect } from "bun:test";
import adapter from "./index";
import sillytavern from "../sillytavern/index";

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
      creator: "chi",
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

  expect(ent.body.prompts.depthInjections).toEqual([
    { text: "remember the map", depth: 3, role: "system", enabled: true, origin: "rolecall_details" },
  ]);

  const p = ent.body.presentation!;
  expect(p.accentColor).toBe("#3a2e1f");
  expect(p.palette).toEqual([{ label: "Ink", name: "ink", hex: "#1a1410" }]);
  expect(p.background).toEqual({ ref: "https://cdn/bg.mp4", overlayOpacity: 0.6, videoPlaybackRate: 1 });
  expect(p.fieldOrder).toEqual(["personality", "scenario"]);
  expect(p.spoilers).toEqual({ mode: "on", order: ["description"] });

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
  expect(card.spec).toBe("chara_card_v2");
  expect(card.data.name).toBe("Vera");
  expect(card.data.first_mes).toBe("You again.");
  expect(card.data.scenario).toBe("at a crossroads inn");
  // greeting titles flatten to plain strings for a format that has no titles
  expect(card.data.alternate_greetings).toEqual(["Oh. It's you.", "Lost again?"]);
  // no RC extension leaks into the ST card
  expect(card.data.extensions?.rolecall).toBeUndefined();
});
