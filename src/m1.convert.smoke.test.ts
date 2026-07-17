/**
 * M1 converter jewel: multi-platform samples detect + convert + re-open.
 * Proves stranger-path codecs without UI.
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { convertFile } from "./convert";
import { loadFormats, registry } from "./core";
import type { AdapterInput, CharacterAdapter } from "./core";

const root = join(import.meta.dir, "..");

const readJson = (rel: string): AdapterInput => {
  const path = join(root, rel);
  const text = readFileSync(path, "utf8");
  return { text, bytes: new TextEncoder().encode(text), filename: rel.split("/").pop() };
};

const readBytes = (rel: string): AdapterInput => {
  const path = join(root, rel);
  const bytes = new Uint8Array(readFileSync(path));
  return { bytes, filename: rel.split("/").pop() };
};

await loadFormats();

/** Narrow registry lookup once: character smoke tests must not see Lorebook/Persona unions. */
const needCharacter = (id: string): CharacterAdapter => {
  const a = registry.get(id);
  if (!a) throw new Error(`m1.smoke: missing adapter ${id}`);
  if (a.kind !== "character") throw new Error(`m1.smoke: ${id} is ${a.kind}, not character`);
  return a;
};

test("M1: formats registry has core character adapters", () => {
  for (const id of [
    "sillytavern",
    "rolecall",
    "risu",
    "agnai",
    "pygmalion",
    "backyard",
    "byaf",
    "lumiverse",
  ]) {
    expect(registry.get(id)?.kind).toBe("character");
  }
});

test("M1: ST v3 sample detect + same-format convert", () => {
  const input = readJson("samples/sillytavern/v3-full.json");
  const src = registry.detect(input)!;
  expect(src.id).toBe("sillytavern");
  const { out } = convertFile(src, needCharacter("sillytavern"), input);
  const again = needCharacter("sillytavern").toCanonical({ text: out.text });
  expect(again.body.identity.name).toBe(
    (src as CharacterAdapter).toCanonical(input).body.identity.name,
  );
});

test("M1: ST → RoleCall → name survives", () => {
  const input = readJson("samples/sillytavern/v3-full.json");
  const { out } = convertFile(needCharacter("sillytavern"), needCharacter("rolecall"), input);
  const ent = needCharacter("rolecall").toCanonical({ text: out.text });
  expect(ent.body.identity.name.length).toBeGreaterThan(0);
});

test("M1: ST → Risu charx → card.json name", () => {
  const input = readJson("samples/sillytavern/v3-full.json");
  const { out } = convertFile(needCharacter("sillytavern"), needCharacter("risu"), input);
  expect(out.bytes).toBeDefined();
  const card = JSON.parse(strFromU8(unzipSync(out.bytes!)["card.json"]!));
  expect(card.data.name.length).toBeGreaterThan(0);
});

test("M1: Agnai sample → ST → re-open name", () => {
  const input = readJson("samples/agnai/robot.native.json");
  expect(registry.detect(input)?.id).toBe("agnai");
  const { out } = convertFile(needCharacter("agnai"), needCharacter("sillytavern"), input);
  const ent = needCharacter("sillytavern").toCanonical({ text: out.text });
  expect(ent.body.identity.name).toBe("Robot");
});

test("M1: Pygmalion classic → ST", () => {
  const input = readJson("samples/pygmalion/classic.native.json");
  expect(registry.detect(input)?.id).toBe("pygmalion");
  const { out } = convertFile(needCharacter("pygmalion"), needCharacter("sillytavern"), input);
  const ent = needCharacter("sillytavern").toCanonical({ text: out.text });
  expect(ent.body.identity.name.length).toBeGreaterThan(0);
});

test("M1: Chub fixture rides ST and keeps extensions.chub on same-format RT", () => {
  const input = readJson("samples/chub/rich.extensions.card.json");
  expect(registry.detect(input)?.id).toBe("sillytavern");
  const { out } = convertFile(needCharacter("sillytavern"), needCharacter("sillytavern"), input);
  const wire = JSON.parse(out.text!);
  expect(wire.data.extensions.chub.full_path).toBe("vaude-fixture/chub-sample");
});

test("M1: Lumiverse fixture detects lumiverse", () => {
  const input = readJson("samples/lumiverse/rich.extensions.card.json");
  expect(registry.detect(input)?.id).toBe("lumiverse");
});

test("M1: Backyard byaf sample detects byaf", () => {
  const input = readBytes("samples/backyard/1.byaf");
  expect(registry.detect(input)?.id).toBe("byaf");
});

test("M1: RoleCall character sample detects rolecall", () => {
  const input = readJson("samples/rolecall/vera-casting-card.v3.json");
  expect(registry.detect(input)?.id).toBe("rolecall");
});


test("M1: Agnai portrait data-URI ? ST assets reopen with same ref", () => {
  const input = readJson("samples/agnai/robot.native.json");
  const src = needCharacter("agnai");
  const ent = src.toCanonical(input);
  // ensure a representable portrait for the conversion proof
  ent.body.media.portrait = {
    role: "portrait",
    ref: "data:image/png;base64,SMOKEPORT",
    mime: "image/png",
    primary: true,
  };
  const out = needCharacter("sillytavern").fromCanonical(ent);
  const again = needCharacter("sillytavern").toCanonical({ text: out.text });
  expect(again.body.media.portrait?.ref).toBe("data:image/png;base64,SMOKEPORT");
  expect(again.body.media.portrait?.mime).toBe("image/png");
  const wire = JSON.parse(out.text!);
  expect(wire.spec).toBe("chara_card_v3");
  expect(wire.data.assets?.some((a: { name: string; uri: string }) => a.name === "main" && a.uri.includes("SMOKEPORT"))).toBe(true);
});
