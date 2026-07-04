import { test, expect } from "bun:test";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { characterAdapter as adapter } from "./index";

/** A minimal but realistic CCv3 card with a Risu-specific extensions block (scripts, opaque). */
function makeCard() {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Vera",
      nickname: "V",
      description: "A wandering cartographer.",
      personality: "curious, dry-humored",
      scenario: "at a crossroads inn",
      first_mes: "You again.",
      mes_example: "<START>\n{{user}}: hi\n{{char}}: hm.",
      system_prompt: "",
      post_history_instructions: "",
      creator_notes: "handle with care",
      creator_notes_multilingual: { ja: "ちゅうい" },
      alternate_greetings: ["Oh. It's you.", "Lost again?"],
      group_only_greetings: ["The party arrives."],
      tags: ["adventure", "oc"],
      creator: "chi",
      character_version: "2.1",
      source: ["risurealm:abc123"],
      creation_date: 1700000000,
      modification_date: 1700000500,
      assets: [
        { type: "icon", uri: "embeded://assets/main.png", name: "main", ext: "png" },
        { type: "emotion", uri: "embeded://assets/happy.png", name: "happy", ext: "png" },
      ],
      // Risu-exclusive executable scripting: must survive untouched, never executed.
      extensions: {
        risuai: {
          triggerscript: [{ type: "start", code: "log('never runs in vaud')" }],
          customScripts: [],
        },
        depth_prompt: { prompt: "stay in character", depth: 4 },
      },
    },
  };
}

/** Pack a synthetic .charx: card.json + two asset files + a module.risum. */
function makeCharx(card: unknown): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "card.json": strToU8(JSON.stringify(card, null, 4)),
    "assets/main.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    "assets/happy.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]),
    "module.risum": new Uint8Array([1, 1, 2, 3, 5, 8, 13]),
  };
  return zipSync(files);
}

test("detect recognizes a .charx (zip with card.json)", () => {
  const bytes = makeCharx(makeCard());
  expect(adapter.detect({ bytes })).toBeGreaterThan(0);
  // A bare zip without card.json is not a charx.
  const notCharx = zipSync({ "readme.txt": strToU8("hi") });
  expect(adapter.detect({ bytes: notCharx })).toBe(0);
  // Non-zip bytes.
  expect(adapter.detect({ bytes: new Uint8Array([1, 2, 3]) })).toBe(0);
});

test("toCanonical reads V3 fields + escrows raw card, assets, module", () => {
  const bytes = makeCharx(makeCard());
  const ent = adapter.toCanonical({ bytes });

  expect(ent.body.identity.name).toBe("Vera");
  expect(ent.body.identity.nickname).toBe("V");
  expect(ent.body.identity.characterVersion).toBe("2.1");
  expect(ent.body.greetings.alternateGreetings).toEqual([{ text: "Oh. It's you." }, { text: "Lost again?" }]);
  expect(ent.body.greetings.groupOnlyGreetings).toEqual([{ text: "The party arrives." }]);
  expect(ent.body.attribution.source).toEqual(["risurealm:abc123"]);
  expect(ent.body.attribution.creatorNotesMultilingual).toEqual({ ja: "ちゅうい" });
  expect(ent.body.attribution.createdAt).toBe(1700000000);
  expect(ent.body.media.portrait?.ref).toBe("embeded://assets/main.png");

  const esc = ent.escrow?.risu;
  expect(esc).toBeTruthy();
  const unmapped = esc!.unmapped as { assetFiles: Record<string, string>; moduleRisum?: string };
  expect(Object.keys(unmapped.assetFiles).sort()).toEqual(["assets/happy.png", "assets/main.png"]);
  expect(unmapped.moduleRisum).toBeTruthy();
});

test("round-trip is lossless: card.json deep-equals, assets + module survive byte-for-byte", () => {
  const original = makeCard();
  const inBytes = makeCharx(original);

  const ent = adapter.toCanonical({ bytes: inBytes });
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("charx");

  const rebuilt = unzipSync(out.bytes!);
  const rebuiltCard = JSON.parse(strFromU8(rebuilt["card.json"]!));
  // Whole card survives, including Risu triggerscript + depth_prompt extensions (never executed).
  expect(rebuiltCard).toEqual(original);

  // Asset + module bytes unchanged (compare unzipped entries, since zip container isn't byte-deterministic).
  expect(Array.from(rebuilt["assets/main.png"]!)).toEqual([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  expect(Array.from(rebuilt["assets/happy.png"]!)).toEqual([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]);
  expect(Array.from(rebuilt["module.risum"]!)).toEqual([1, 1, 2, 3, 5, 8, 13]);
});

test("maps CCv3 assets with a DERIVED mime (not the bare ext) and the full role set", () => {
  const ent = adapter.toCanonical({ bytes: makeCharx(makeCard()) });
  // the emotion asset: label from name, mime derived from ext ("png" -> image/png), never the raw ext
  expect(ent.body.media.assets).toContainEqual({
    role: "emotion",
    label: "happy",
    ref: "embeded://assets/happy.png",
    mime: "image/png",
  });
  expect(ent.body.media.portrait?.primary).toBe(true);
});

test("normalizes Risu millisecond dates to seconds, restoring the raw ms on export (lossless)", () => {
  const card = makeCard();
  card.data.creation_date = 1716990563878; // milliseconds, as Risu writes them
  card.data.modification_date = 1761917762720;
  const ent = adapter.toCanonical({ bytes: makeCharx(card) });
  expect(ent.body.attribution.createdAt).toBe(1716990563); // seconds in the canonical model
  expect(ent.body.attribution.updatedAt).toBe(1761917762);

  const rebuilt = JSON.parse(strFromU8(unzipSync(adapter.fromCanonical(ent).bytes!)["card.json"]!));
  expect(rebuilt.data.creation_date).toBe(1716990563878); // raw ms preserved byte-for-byte
  expect(rebuilt.data.modification_date).toBe(1761917762720);
});

test("flags opaque executable content + privilege on escrow, without ever running it", () => {
  // makeCard carries a triggerscript -> flagged as executable, not privileged
  const ent = adapter.toCanonical({ bytes: makeCharx(makeCard()) });
  expect(ent.escrow?.risu?.unmapped?.["hasExecutableContent"]).toBe(true);
  expect(ent.escrow?.risu?.unmapped?.["privileged"]).toBe(false);

  // a card requesting low-level access -> privileged
  const priv = makeCard();
  (priv.data.extensions.risuai as Record<string, unknown>).lowLevelAccess = true;
  const privEnt = adapter.toCanonical({ bytes: makeCharx(priv) });
  expect(privEnt.escrow?.risu?.unmapped?.["privileged"]).toBe(true);

  // a clean card with no scripts/module -> not flagged
  const clean = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Clean", extensions: {} } };
  const cleanEnt = adapter.toCanonical({ bytes: zipSync({ "card.json": strToU8(JSON.stringify(clean)) }) });
  expect(cleanEnt.escrow?.risu?.unmapped?.["hasExecutableContent"]).toBe(false);
});

test("a .charx whose card.json lacks a data object fails at the boundary, clearly", () => {
  const bad = zipSync({ "card.json": strToU8(JSON.stringify({ spec: "chara_card_v3" })) });
  expect(() => adapter.toCanonical({ bytes: bad })).toThrow("risu: card.json has no data object");
});

test("an edit to the canonical body is reflected in the rebuilt card.json", () => {
  const ent = adapter.toCanonical({ bytes: makeCharx(makeCard()) });
  ent.body.identity.description = "A retired cartographer, now an innkeeper.";
  const out = adapter.fromCanonical(ent);
  const rebuiltCard = JSON.parse(strFromU8(unzipSync(out.bytes!)["card.json"]!));
  expect(rebuiltCard.data.description).toBe("A retired cartographer, now an innkeeper.");
  // Untouched Risu scripting still rides along.
  expect(rebuiltCard.data.extensions.risuai.triggerscript[0].code).toBe("log('never runs in vaud')");
});

// -- De-escrow (real sample): the authored risuai scalar surface is first-class, edit-tested against
// the real cherry card (samples/risu/cherry.card.json, sliced from the 23.7MB cherry.charx; see
// samples/risu/SOURCES.md). The codec previously mapped ZERO risuai fields. --

import { readFileSync } from "node:fs";
import { join } from "node:path";

const cherryCharx = (): Uint8Array =>
  zipSync({
    "card.json": strToU8(
      readFileSync(join(import.meta.dir, "../../../samples/risu/cherry.card.json"), "utf8"),
    ),
  });

test("de-escrow read: real cherry risuai scalars land in first-class canonical slots", () => {
  const ent = adapter.toCanonical({ bytes: cherryCharx() });
  expect(ent.body.settings?.risu?.viewScreen).toBe("none");
  expect(ent.body.settings?.risu?.largePortrait).toBe(true);
  // 7 sdData rows -> imagePrompt.rows (label/value pairs)
  expect(ent.body.persona.imagePrompt?.rows?.length).toBe(7);
  expect(ent.body.persona.imagePrompt?.rows?.[0]?.label).toBeDefined();
  // empty-but-present on cherry stays unset (nothing authored): bias [], vits {}, additionalText ""
  expect(ent.body.bias).toBeUndefined();
  expect(ent.body.persona.voice).toBeUndefined();
  expect(ent.body.prompts.additionalText).toBeUndefined();
});

test("de-escrow round-trip: unedited cherry card.json re-emits data-identical", () => {
  const ent = adapter.toCanonical({ bytes: cherryCharx() });
  const out = JSON.parse(strFromU8(unzipSync(adapter.fromCanonical(ent).bytes!)["card.json"]!));
  const orig = JSON.parse(readFileSync(join(import.meta.dir, "../../../samples/risu/cherry.card.json"), "utf8"));
  expect(out).toEqual(orig);
});

test("de-escrow edit: mutating toggles/bias/license/rows reaches the risuai wire, siblings survive", () => {
  const ent = adapter.toCanonical({ bytes: cherryCharx() });
  ent.body.settings!.risu!.viewScreen = "emotion";
  ent.body.bias = [{ phrase: "solo", weight: -5 }];
  ent.body.attribution.license = "CC-BY-4.0";
  ent.body.persona.imagePrompt!.rows![0] = { label: "always", value: "watercolor" };
  const out = JSON.parse(strFromU8(unzipSync(adapter.fromCanonical(ent).bytes!)["card.json"]!));
  const r = out.data.extensions.risuai;
  expect(r.viewScreen).toBe("emotion");
  expect(r.largePortrait).toBe(true); // unedited toggle survives
  expect(r.bias).toEqual([["solo", -5]]);
  expect(r.license).toBe("CC-BY-4.0");
  expect(r.sdData[0]).toEqual(["always", "watercolor"]);
  expect(r.sdData.length).toBe(7);
  // untouched authored behavior surface rides the twin verbatim (its entity slice is pending)
  expect(r.customScripts.length).toBe(8);
  expect(r.triggerscript.length).toBe(9);
});
