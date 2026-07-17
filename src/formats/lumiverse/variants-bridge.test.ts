/**
 * alternate_fields / alternate_avatars <-> body.variants
 */
import { test, expect } from "bun:test";
import { altsToVariants, variantsToAlts, applyAltsToBody, applyVariantsToExtensions } from "./variants-bridge";
import type { CharacterBody } from "../../entities/character/schema";

test("altsToVariants merges same label across fields + face", () => {
  const variants = altsToVariants({
    alternate_fields: {
      description: [{ id: "1", label: "Formal", content: "A composed archivist." }],
      personality: [{ id: "1b", label: "Formal", content: "precise" }],
    },
    alternate_avatars: [{ id: "1", label: "Formal", image_id: "data:image/png;base64,XX" }],
  });
  expect(variants.length).toBe(1);
  expect(variants[0]!.label).toBe("Formal");
  expect(variants[0]!.overrides.identity?.description).toBe("A composed archivist.");
  expect(variants[0]!.overrides.persona?.personality).toBe("precise");
  expect(variants[0]!.overrides.media?.portrait?.ref).toBe("data:image/png;base64,XX");
});

test("variantsToAlts emits per-slot rows and faces", () => {
  const alts = variantsToAlts([
    {
      id: "v1",
      label: "Rain",
      overrides: {
        identity: { description: "wet rails" },
        persona: { scenario: "tram" },
        media: { portrait: { role: "portrait", ref: "data:image/png;base64,YY", primary: true } },
      },
    },
  ]);
  expect(alts.alternate_fields?.description?.[0]).toMatchObject({
    id: "v1",
    label: "Rain",
    content: "wet rails",
  });
  expect(alts.alternate_fields?.scenario?.[0]?.content).toBe("tram");
  expect(alts.alternate_avatars?.[0]?.image_id).toBe("data:image/png;base64,YY");
});

test("round-trip alts → variants → alts keeps content", () => {
  const ext = {
    alternate_fields: {
      description: [{ id: "a", label: "A", content: "desc" }],
      scenario: [{ id: "a", label: "A", content: "scen" }],
    },
  };
  const variants = altsToVariants(ext);
  const back = variantsToAlts(variants);
  expect(back.alternate_fields?.description?.[0]?.content).toBe("desc");
  expect(back.alternate_fields?.scenario?.[0]?.content).toBe("scen");
});

test("applyAltsToBody sets variants; applyVariantsToExtensions overwrites wire", () => {
  const body: CharacterBody = {
    identity: { name: "X" },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  };
  const next = applyAltsToBody(body, {
    alternate_fields: { description: [{ label: "V", content: "d" }] },
  });
  expect(next.variants?.length).toBe(1);
  const ext = applyVariantsToExtensions({ expressions: { enabled: true } }, next);
  expect(ext.expressions).toEqual({ enabled: true });
  expect((ext.alternate_fields as { description: unknown[] }).description.length).toBe(1);
});
