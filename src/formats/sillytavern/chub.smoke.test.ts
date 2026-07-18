/**
 * Chub jewel smoke (ST path): open sample with extensions.chub → edit bag + body → export → re-open.
 * Proves the convert loop Platform · Chub relies on (no separate formats/chub adapter).
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { characterAdapter as adapter } from "./index";

const samplePath = join(import.meta.dir, "../../../samples/chub/characters/rich.extensions.card.json");

type ChubBag = {
  id?: number;
  full_path?: string;
  background_image?: string;
  custom_css?: string;
  preset?: string | null;
  related_lorebooks?: unknown[];
  expressions?: unknown;
  alt_expressions?: unknown;
  extensions?: unknown;
};

type Card = {
  data: {
    name: string;
    extensions: {
      chub: ChubBag;
      depth_prompt?: unknown;
      talkativeness?: string;
    };
  };
};

const chubOf = (ent: ReturnType<typeof adapter.toCanonical>): ChubBag => {
  const raw = ent.original?.sillytavern?.raw as Card | undefined;
  if (!raw?.data?.extensions?.chub) throw new Error("chub.smoke: missing extensions.chub on twin");
  return raw.data.extensions.chub;
};

test("detect: chub fixture is a normal ST CCv3 card", () => {
  const raw = readFileSync(samplePath, "utf8");
  expect(adapter.detect({ text: raw })).toBeGreaterThan(0.5);
});

test("smoke: open sample → chub bag present on twin", () => {
  const raw = readFileSync(samplePath, "utf8");
  const ent = adapter.toCanonical({ text: raw });
  expect(ent.body.identity.name).toBe("Chub Sample");
  expect(ent.original?.sillytavern?.raw).toBeDefined();

  const chub = chubOf(ent);
  expect(chub.id).toBe(99001);
  expect(chub.full_path).toBe("vaude-fixture/chub-sample");
  expect(chub.background_image).toContain("dock.webp");
  expect(chub.custom_css).toContain(".chub-bubble");
  expect(chub.preset).toBe("vaude-fixture/default-preset");
  expect(Array.isArray(chub.related_lorebooks)).toBe(true);
  expect((chub.related_lorebooks as unknown[]).length).toBe(1);
  expect(Array.isArray(chub.extensions)).toBe(true);
});

test("smoke: edit body + chub bag → export → re-open keeps both", () => {
  const raw = readFileSync(samplePath, "utf8");
  const ent = adapter.toCanonical({ text: raw });

  ent.body.identity.name = "Chub Edited";
  const chub = chubOf(ent);
  chub.background_image = "https://example.invalid/bg/edited.webp";
  chub.custom_css = "/* edited */\n.chub-bubble { color: #fff; }\n";
  chub.full_path = "vaude-fixture/chub-edited";
  chub.preset = "vaude-fixture/alt-preset";
  chub.related_lorebooks = [
    { id: 2002, path: "vaude-fixture/new-lore", version: "1" },
  ];
  chub.id = 99002;

  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  expect(out.text).toBeTruthy();

  const wire = JSON.parse(out.text!) as Card;
  expect(wire.data.name).toBe("Chub Edited");
  expect(wire.data.extensions.chub.background_image).toBe("https://example.invalid/bg/edited.webp");
  expect(wire.data.extensions.chub.custom_css).toContain("/* edited */");
  expect(wire.data.extensions.chub.full_path).toBe("vaude-fixture/chub-edited");
  expect(wire.data.extensions.chub.preset).toBe("vaude-fixture/alt-preset");
  expect(wire.data.extensions.chub.id).toBe(99002);
  expect((wire.data.extensions.chub.related_lorebooks as { id: number }[])[0]!.id).toBe(2002);
  // non-chub ST extensions still ride
  expect(wire.data.extensions.talkativeness).toBe("0.5");
  expect(wire.data.extensions.depth_prompt).toBeDefined();

  const again = adapter.toCanonical({ text: out.text! });
  expect(again.body.identity.name).toBe("Chub Edited");
  const chub2 = chubOf(again);
  expect(chub2.background_image).toBe("https://example.invalid/bg/edited.webp");
  expect(chub2.custom_css).toContain("/* edited */");
  expect(chub2.full_path).toBe("vaude-fixture/chub-edited");
  expect(chub2.id).toBe(99002);
});

test("smoke: unedited sample deep-equals through open/export", () => {
  const raw = readFileSync(samplePath, "utf8");
  const original = JSON.parse(raw) as unknown;
  const ent = adapter.toCanonical({ text: raw });
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out).toEqual(original);
});
