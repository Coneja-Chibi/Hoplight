/**
 * BYAF (.byaf zip) adapter tests against official ahoylabs sample archives.
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { byafAdapter as adapter } from "./byaf";
import { characterAdapter as sillytavern } from "../sillytavern/index";

const sample = (n: 1 | 2 | 3): Uint8Array =>
  new Uint8Array(readFileSync(join(import.meta.dir, `../../../samples/backyard/characters/${n}.byaf`)));

test("detect: samples score 1; non-zip and random zip score 0", () => {
  expect(adapter.detect({ bytes: sample(1) })).toBe(1);
  expect(adapter.detect({ bytes: sample(2) })).toBe(1);
  expect(adapter.detect({ text: "{}" })).toBe(0);
  expect(adapter.detect({ bytes: new Uint8Array([0, 1, 2, 3]) })).toBe(0);
});

test("1.byaf: maps character + primary scenario + avatar portrait", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  expect(ent.body.identity.name).toBe("Test Bot");
  expect(ent.body.identity.nickname).toBe("TestBot");
  expect(ent.body.identity.description).toBe("A test character");
  expect(ent.body.persona.scenario).toBe("A test scenario");
  expect(ent.body.prompts.systemPrompt).toBe("You are a test bot");
  expect(ent.body.greetings.firstMessage).toBe("Hello, I am a test bot!");
  expect(ent.body.media.portrait?.ref.startsWith("data:image/jpeg;base64,")).toBe(true);
  expect(ent.body.discovery.rating).toBe("all-ages");
  expect(ent.original?.byaf?.raw).toBeDefined();
});

test("2.byaf: examples, background, author", () => {
  const ent = adapter.toCanonical({ bytes: sample(2) });
  expect(ent.body.examples.exampleMessages).toContain("Hello, I am a test bot!");
  expect(ent.body.presentation?.background?.ref.startsWith("data:image/")).toBe(true);
  expect(ent.body.attribution.creator).toBe("Test Author");
  expect(ent.body.attribution.sourceUrl).toBe("https://backyard.ai/hub/user/test");
  // extra image beyond avatar
  expect(ent.body.media.assets?.length).toBeGreaterThanOrEqual(1);
});

test("3.byaf: multi-scenario folds second scenario greeting into alt greetings", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  expect(ent.body.greetings.firstMessage).toBe("Hello, I am a test bot!");
  expect(ent.body.greetings.alternateGreetings?.some((g) => g.title === "Second scenario")).toBe(true);
});

test("round-trip 1.byaf: unedited archive re-opens with same authored fields", () => {
  const bytes = sample(1);
  const ent = adapter.toCanonical({ bytes });
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("byaf");
  expect(out.bytes).toBeTruthy();
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.identity.name).toBe(ent.body.identity.name);
  expect(again.body.greetings.firstMessage).toBe(ent.body.greetings.firstMessage);
  expect(again.body.identity.description).toBe(ent.body.identity.description);
  expect(again.body.media.portrait?.ref.startsWith("data:image/")).toBe(true);
});

test("edit name reaches re-packed character.json", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  ent.body.identity.name = "Renamed Bot";
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const charPath = Object.keys(files).find((k) => k.endsWith("character.json"));
  expect(charPath).toBeTruthy();
  const ch = JSON.parse(strFromU8(files[charPath!]!));
  expect(ch.displayName).toBe("Renamed Bot");
});

test("sampling / chat stay on original (not stripped by edit)", () => {
  const ent = adapter.toCanonical({ bytes: sample(2) });
  ent.body.persona.scenario = "Edited narrative";
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const scenPath = Object.keys(files).find((k) => k.includes("scenario") && k.endsWith(".json"));
  const sc = JSON.parse(strFromU8(files[scenPath!]!));
  expect(sc.narrative).toBe("Edited narrative");
  expect(sc.temperature).toBe(0.7);
  expect(sc.promptTemplate).toBe("general");
  expect(Array.isArray(sc.messages)).toBe(true);
  expect(sc.messages.length).toBeGreaterThan(0);
});

test("cross-format: byaf -> sillytavern keeps name and greeting", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  const st = sillytavern.fromCanonical(ent);
  const card = JSON.parse(st.text!);
  expect(card.data.name).toBe("Test Bot");
  expect(card.data.first_mes).toBe("Hello, I am a test bot!");
});

test("edit portrait data URI rewrites images/avatar in the re-packed archive", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  // 1x1 PNG
  const pngB64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  ent.body.media.portrait = {
    role: "portrait",
    label: "avatar",
    ref: `data:image/png;base64,${pngB64}`,
    mime: "image/png",
    primary: true,
  };
  const out = adapter.fromCanonical(ent);
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.media.portrait?.ref).toContain(pngB64);
  const files = unzipSync(out.bytes!);
  const avatarKey = Object.keys(files).find((k) => k.includes("images/") && k.includes("avatar"));
  expect(avatarKey).toBeTruthy();
  expect(files[avatarKey!]!.length).toBeGreaterThan(0);
});

test("edit background data URI rewrites scenario backgroundImage bytes", () => {
  const ent = adapter.toCanonical({ bytes: sample(2) });
  const pngB64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  ent.body.presentation = {
    background: { ref: `data:image/png;base64,${pngB64}` },
  };
  const out = adapter.fromCanonical(ent);
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.presentation?.background?.ref).toContain(pngB64);
});

test("clearing all images empties character images and deletes the archived files", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  expect(ent.body.media.portrait).toBeDefined(); // precondition: imported carrying an avatar
  // The editor clears media by dropping the keys (writePath deletes on empty), so a full clear
  // arrives as portrait undefined + no assets. The stale rows and files must not survive.
  ent.body.media.portrait = undefined;
  ent.body.media.assets = undefined;
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const charPath = Object.keys(files).find((k) => k.endsWith("character.json"))!;
  const ch = JSON.parse(strFromU8(files[charPath]!));
  expect(Array.isArray(ch.images) ? ch.images : []).toEqual([]);
  expect(Object.keys(files).filter((k) => k.includes("/images/") && !k.endsWith("/"))).toEqual([]);
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.media.portrait).toBeUndefined();
});

test("clearing the background removes scenario backgroundImage and its file", () => {
  const ent = adapter.toCanonical({ bytes: sample(2) });
  expect(ent.body.presentation?.background?.ref).toBeDefined(); // precondition
  ent.body.presentation = undefined;
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const scenPath = Object.keys(files).find((k) => k.includes("scenario") && k.endsWith(".json"))!;
  const sc = JSON.parse(strFromU8(files[scenPath]!));
  expect(sc.backgroundImage ?? undefined).toBeUndefined();
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.presentation?.background).toBeUndefined();
});

test("unedited multi-scenario round-trip keeps titled alt from secondary scenario", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const out = adapter.fromCanonical(ent);
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.greetings.alternateGreetings?.some((g) => g.title === "Second scenario")).toBe(
    true,
  );
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(2);
});

test("new titled alt auto-splits into a new secondary scenario file", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  ent.body.greetings.alternateGreetings = [
    { text: "Brand new opening", title: "Rainy alley" },
  ];
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(2);
  const secondPath = man.scenarios[1] as string;
  expect(secondPath).toMatch(/^scenarios\/scenario\d+\.json$/);
  const sc2 = JSON.parse(strFromU8(files[secondPath]!));
  expect(sc2.narrative).toBe("Rainy alley");
  expect(sc2.title).toBe("Rainy alley");
  expect(sc2.firstMessages?.[0]?.text).toBe("Brand new opening");

  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(
    again.body.greetings.alternateGreetings?.some(
      (g) => g.title === "Rainy alley" && g.text === "Brand new opening",
    ),
  ).toBe(true);
});

test("edit existing titled alt rewrites matching secondary firstMessage, keeps scenario count", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const alts = ent.body.greetings.alternateGreetings ?? [];
  const second = alts.find((g) => g.title === "Second scenario");
  expect(second).toBeTruthy();
  second!.text = "Rewritten second greeting";
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(2);
  const sc2 = JSON.parse(strFromU8(files[man.scenarios[1] as string]!));
  expect(sc2.firstMessages?.[0]?.text).toBe("Rewritten second greeting");
  // chat transcript on twin should still be present
  expect(Array.isArray(sc2.messages)).toBe(true);
  expect(sc2.messages.length).toBeGreaterThan(0);
});

test("removing titled alt drops orphan secondary scenario from archive", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  ent.body.greetings.alternateGreetings = [];
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(1);
  expect(Object.keys(files).some((k) => k === "scenarios/scenario2.json")).toBe(false);
  const again = adapter.toCanonical({ bytes: out.bytes! });
  expect(again.body.greetings.alternateGreetings ?? []).toEqual([]);
});

// Stable scenario greeting identities.

test("import mints deterministic unique greeting ids from scenario paths", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const alts = ent.body.greetings.alternateGreetings ?? [];
  const second = alts.find((g) => g.title === "Second scenario");
  expect(second?.id).toBeTruthy();
  expect(second!.id!.startsWith("byaf:")).toBe(true);
  expect(second!.id).toContain("scenario");
  // re-import same archive yields identical ids
  const again = adapter.toCanonical({ bytes: sample(3) });
  const againAlts = again.body.greetings.alternateGreetings ?? [];
  expect(againAlts.map((g) => g.id)).toEqual(alts.map((g) => g.id));
  expect(new Set(alts.map((g) => g.id).filter(Boolean)).size).toBe(
    alts.filter((g) => g.id).length,
  );
});

test("retitle secondary preserves path, chat, grammar, sampler via stable id", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const alts = ent.body.greetings.alternateGreetings ?? [];
  const second = alts.find((g) => g.title === "Second scenario");
  expect(second?.id).toBeTruthy();
  const keepId = second!.id!;
  const keepPath = keepId.slice("byaf:".length).split("#")[0]!;
  second!.title = "Completely New Title";
  second!.text = "Retitled opening";
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(2);
  expect(man.scenarios[1]).toBe(keepPath);
  const sc2 = JSON.parse(strFromU8(files[keepPath]!));
  expect(sc2.narrative).toBe("Completely New Title");
  expect(sc2.firstMessages?.[0]?.text).toBe("Retitled opening");
  expect(Array.isArray(sc2.messages)).toBe(true);
  expect(sc2.messages.length).toBeGreaterThan(0);
  // opaque residue: sampling knobs if present
  if (sc2.temperature !== undefined) expect(typeof sc2.temperature).toBe("number");
});

test("empty-title secondary stays secondary when id marks the path", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const alts = ent.body.greetings.alternateGreetings ?? [];
  const second = alts.find((g) => g.id?.includes("scenario2") || g.title === "Second scenario");
  expect(second).toBeTruthy();
  const keepId = second!.id!;
  second!.title = undefined;
  second!.text = "Untitled but secondary";
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(2);
  const path = keepId.slice("byaf:".length).split("#")[0]!;
  expect(man.scenarios).toContain(path);
  const sc2 = JSON.parse(strFromU8(files[path]!));
  expect(sc2.firstMessages?.[0]?.text).toBe("Untitled but secondary");
});

test("duplicate titles keep distinct paths because identities differ", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const alts = ent.body.greetings.alternateGreetings ?? [];
  const second = alts.find((g) => g.title === "Second scenario");
  expect(second?.id).toBeTruthy();
  // add a NEW secondary with the same title but no id
  ent.body.greetings.alternateGreetings = [
    ...alts,
    { text: "Twin title opener", title: "Second scenario" },
  ];
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  expect(man.scenarios.length).toBe(3);
  const paths = man.scenarios as string[];
  expect(new Set(paths).size).toBe(3);
});

test("reorder alts does not swap scenario file identity", () => {
  const ent = adapter.toCanonical({ bytes: sample(3) });
  const alts = [...(ent.body.greetings.alternateGreetings ?? [])];
  const second = alts.find((g) => g.title === "Second scenario");
  expect(second?.id).toBeTruthy();
  const keepId = second!.id!;
  // put a new titled alt first, then the original second
  ent.body.greetings.alternateGreetings = [
    { text: "Inserted first", title: "Inserted" },
    second!,
    ...alts.filter((g) => g !== second),
  ];
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  const path = keepId.slice("byaf:".length).split("#")[0]!;
  const sc = JSON.parse(strFromU8(files[path]!));
  expect(sc.firstMessages?.[0]?.text).toBe(second!.text);
  expect(Array.isArray(sc.messages) && sc.messages.length > 0).toBe(true);
});

test("hostile greeting id is never used as an archive path", () => {
  const ent = adapter.toCanonical({ bytes: sample(1) });
  ent.body.greetings.alternateGreetings = [
    { text: "pwn", title: "Evil", id: "byaf:../../../evil.json" },
    { text: "pwn2", title: "Evil2", id: "byaf:scenarios/../manifest.json" },
  ];
  const out = adapter.fromCanonical(ent);
  const files = unzipSync(out.bytes!);
  expect(files["evil.json"]).toBeUndefined();
  expect(files["../../../evil.json"]).toBeUndefined();
  const man = JSON.parse(strFromU8(files["manifest.json"]!));
  for (const p of man.scenarios as string[]) {
    expect(p.startsWith("scenarios/")).toBe(true);
    expect(p.includes("..")).toBe(false);
  }
});
