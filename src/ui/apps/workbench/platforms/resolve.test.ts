import { expect, test } from "bun:test";
import { resolvePlatformFields } from "./resolve";
import type { Platform, OwnField } from "./types";
import type { FieldModule } from "../fields";

const mod = (id: string, path: string): FieldModule => ({
  id,
  path,
  kind: "text",
  step: "casting",
  question: id,
  sheetLabel: id,
});

const catalog = new Map<string, FieldModule>([
  ["name", mod("name", "identity.name")],
  ["description", mod("description", "identity.description")],
  ["talkativeness", mod("talkativeness", "settings.talkativeness")],
]);

const own = (id: string): OwnField => ({ id, label: id, path: `x.${id}`, control: "text" });

const platforms: Platform[] = [
  { key: "sillytavern", label: "SillyTavern", fields: ["name", "description", "talkativeness", own("fav")] },
  { key: "rolecall", label: "RoleCall", fields: ["name", "description", own("trackerPreset")] },
];

test("resolves common ids to catalog modules and keeps own fields inline", () => {
  const out = resolvePlatformFields(platforms, ["sillytavern"], catalog);
  expect(out.map((f) => f.id)).toEqual(["name", "description", "talkativeness", "fav"]);
  expect(out[0]).toEqual({ source: "common", id: "name", module: catalog.get("name")! });
  expect(out[3]).toEqual({ source: "own", id: "fav", field: own("fav") });
});

test("dedupes shared fields across platforms: common ones show once", () => {
  const out = resolvePlatformFields(platforms, ["sillytavern", "rolecall"], catalog);
  // name + description shared -> once each; then each platform's own field
  expect(out.map((f) => f.id)).toEqual(["name", "description", "talkativeness", "fav", "trackerPreset"]);
});

test("selecting only a later platform still resolves its own fields", () => {
  const out = resolvePlatformFields(platforms, ["rolecall"], catalog);
  expect(out.map((f) => f.id)).toEqual(["name", "description", "trackerPreset"]);
});

test("an unknown common id resolves to nothing (visible gap, not an editor bound to null)", () => {
  const bad: Platform[] = [{ key: "x", label: "X", fields: ["name", "nope", own("z")] }];
  const out = resolvePlatformFields(bad, ["x"], catalog);
  expect(out.map((f) => f.id)).toEqual(["name", "z"]);
});

test("empty selection yields nothing", () => {
  expect(resolvePlatformFields(platforms, [], catalog)).toEqual([]);
});
