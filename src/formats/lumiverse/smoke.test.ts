/**
 * Lumiverse jewel smoke: JSON fixture + modules ZIP open → edit → export → re-open.
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { characterAdapter as adapter } from "./index";
import { isDataUri } from "./modules";

const samplePath = join(import.meta.dir, "../../../samples/lumiverse/characters/rich.extensions.card.json");

// minimal valid 1x1 png
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

test("detect: rich fixture scores high; plain ST card without fingerprints scores 0", () => {
  const raw = readFileSync(samplePath, "utf8");
  expect(adapter.detect({ text: raw })).toBe(0.95);
  expect(
    adapter.detect({
      text: JSON.stringify({
        spec: "chara_card_v2",
        data: { name: "Plain", description: "x", extensions: {} },
      }),
    }),
  ).toBe(0);
});

test("smoke JSON: open → variants from alts → edit → export alts from variants", () => {
  const raw = readFileSync(samplePath, "utf8");
  const ent = adapter.toCanonical({ text: raw });
  expect(ent.body.identity.name).toBe("Lumi Sample");
  expect(ent.original?.sillytavern?.raw).toBeDefined();
  // alternate_fields (Formal, Rain route) land as body.variants for VariantStrip
  expect(ent.body.variants?.length).toBeGreaterThanOrEqual(1);
  expect(ent.body.variants?.some((v) => v.label === "Formal" || v.label === "Rain route")).toBe(true);

  const card = ent.original!.sillytavern!.raw as {
    data: { extensions: Record<string, unknown> };
  };
  expect((card.data.extensions.expressions as { enabled: boolean }).enabled).toBe(true);
  expect((card.data.extensions.lumiverse_image_gen_lora as { lora_filename: string }).lora_filename).toContain(
    "sample_lumi",
  );

  ent.body.identity.name = "Lumi Edited";
  card.data.extensions.alternate_character_name = "Aria Prime";
  (card.data.extensions.lumiverse_image_gen_lora as { weight: number }).weight = 0.5;
  // Author a variant the way VariantStrip would
  ent.body.variants = [
    {
      id: "v-rain",
      label: "Rain route",
      overrides: {
        identity: { description: "edited rain desc" },
        persona: { scenario: "edited tram" },
      },
    },
  ];

  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  const wire = JSON.parse(out.text!);
  expect(wire.data.name).toBe("Lumi Edited");
  expect(wire.data.extensions.alternate_character_name).toBe("Aria Prime");
  expect(wire.data.extensions.lumiverse_image_gen_lora.weight).toBe(0.5);
  expect(wire.data.extensions.expressions.mappings.neutral).toBe("img-neutral");
  expect(wire.data.extensions.alternate_fields.description[0].content).toBe("edited rain desc");
  expect(wire.data.extensions.alternate_fields.scenario[0].content).toBe("edited tram");

  const again = adapter.toCanonical({ text: out.text! });
  expect(again.body.identity.name).toBe("Lumi Edited");
  expect(again.body.variants?.some((v) => v.overrides.identity?.description === "edited rain desc")).toBe(
    true,
  );
  const ext = (again.original!.sillytavern!.raw as typeof card).data.extensions;
  expect(ext.alternate_character_name).toBe("Aria Prime");
});

test("smoke modules ZIP: rehydrate paths to data URIs; edit survives re-pack", () => {
  const card = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Zip Lumi",
      description: "modules fixture",
      personality: "",
      scenario: "",
      first_mes: "hi",
      mes_example: "",
      creator: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags: [],
      alternate_greetings: [],
      extensions: {},
    },
  };
  const path = "assets/other/image/expr_neutral.png";
  const modules = {
    version: 1,
    expressions: {
      enabled: true,
      defaultExpression: "neutral",
      mappings: { neutral: path },
    },
    alternate_fields: {
      description: [{ id: "1", label: "A", content: "alt desc" }],
    },
  };
  const bytes = zipSync({
    "card.json": strToU8(JSON.stringify(card)),
    "lumiverse_modules.json": strToU8(JSON.stringify(modules)),
    [path]: PNG,
  });

  expect(adapter.detect({ bytes })).toBe(1);

  const ent = adapter.toCanonical({ bytes });
  expect(ent.body.identity.name).toBe("Zip Lumi");
  const ext = (ent.original!.sillytavern!.raw as { data: { extensions: Record<string, unknown> } }).data
    .extensions;
  const expr = ext.expressions as { mappings: Record<string, string>; enabled: boolean };
  expect(expr.enabled).toBe(true);
  expect(isDataUri(expr.mappings.neutral!)).toBe(true);
  expect(ent.body.media.assets?.some((a) => a.label === "neutral")).toBe(true);
  expect((ext.alternate_fields as { description: unknown[] }).description.length).toBe(1);

  ent.body.identity.name = "Zip Edited";
  (ext.expressions as { defaultExpression: string }).defaultExpression = "neutral";

  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("charx");
  expect(out.bytes).toBeTruthy();

  const files = unzipSync(out.bytes!);
  expect(files["card.json"]).toBeTruthy();
  expect(files["lumiverse_modules.json"]).toBeTruthy();
  const cardOut = JSON.parse(strFromU8(files["card.json"]!));
  expect(cardOut.data.name).toBe("Zip Edited");
  const modOut = JSON.parse(strFromU8(files["lumiverse_modules.json"]!));
  expect(modOut.expressions.mappings.neutral).toMatch(/^assets\//);

  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.identity.name).toBe("Zip Edited");
  const map2 = (
    (again.original!.sillytavern!.raw as { data: { extensions: { expressions: { mappings: Record<string, string> } } } })
      .data.extensions.expressions.mappings
  );
  expect(isDataUri(map2.neutral!)).toBe(true);
});


test("from-scratch portable media projects into Lumi card assets as emotion", () => {
  const ent = adapter.toCanonical({
    text: JSON.stringify({
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "LumiMed",
        description: "d",
        personality: "",
        scenario: "",
        first_mes: "hi",
        mes_example: "",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "",
        character_version: "1.0",
        extensions: {
          expressions: { enabled: true },
        },
      },
    }),
  });
  ent.body.media = {
    portrait: {
      role: "portrait",
      label: "main",
      ref: "data:image/png;base64,LU",
      mime: "image/png",
      primary: true,
    },
    assets: [
      { role: "emotion", label: "neutral", ref: "https://cdn/n.png", mime: "image/png" },
    ],
  };
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out.data.assets).toContainEqual({
    type: "icon",
    name: "main",
    uri: "data:image/png;base64,LU",
    ext: "png",
  });
  expect(out.data.assets).toContainEqual({
    type: "emotion",
    name: "neutral",
    uri: "https://cdn/n.png",
    ext: "png",
  });
});

test("flat input stamps variant flat and re-emits top-level only (no nested data)", () => {
  const flat = {
    name: "FlatLumi",
    description: "d",
    personality: "p",
    scenario: "s",
    first_mes: "hi",
    mes_example: "",
    extensions: { expressions: { enabled: true } },
  };
  const ent = adapter.toCanonical({ text: JSON.stringify(flat) });
  expect(ent.original?.sillytavern?.unmapped?.["variant"]).toBe("flat");
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  const parsed = JSON.parse(out.text!);
  expect(parsed.data).toBeUndefined();
  expect(parsed.name).toBe("FlatLumi");
  expect(parsed.first_mes).toBe("hi");
});

test("requestedExtension charx forces zip; requested json stays json for non-archive twin", () => {
  const raw = readFileSync(samplePath, "utf8");
  const ent = adapter.toCanonical({ text: raw });
  const asCharx = adapter.fromCanonical(ent, { requestedExtension: "charx" });
  expect(asCharx.suggestedExtension).toBe("charx");
  expect(asCharx.bytes?.[0]).toBe(0x50);
  expect(asCharx.bytes?.[1]).toBe(0x4b);
  const asJson = adapter.fromCanonical(ent, { requestedExtension: "json" });
  expect(asJson.suggestedExtension).toBe("json");
  expect(JSON.parse(asJson.text!).data.name).toBe("Lumi Sample");
});
