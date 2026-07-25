/** Pack/media capability coverage for item lifecycle, group retention, and escrow safety. */
import { expect, test } from "bun:test";
import type { CanonicalPack } from "../schema";
import settings from "./settings";
import items from "./items";
import groups from "./groups";

const pack = (): CanonicalPack => ({
  schemaVersion: "1",
  kind: "pack",
  id: "faces",
  body: {
    name: "Faces",
    pack: { defaultLabel: "neutral", items: [{ id: "n", label: "neutral", ref: "asset://n" }] },
    groups: { side: { items: [{ id: "s", label: "smile", ref: "asset://s" }] } },
  },
  original: { lumiverse: { raw: { sealed: true } } },
});

test("settings and item operations preserve groups and escrow", () => {
  const before = pack();
  const named = settings.preview(before, settings.input.parse({
    target: { id: "faces" },
    patch: { brief: "Expressions", enabled: false },
  }));
  const added = items.preview(named.entity, items.input.parse({
    target: { id: "faces" },
    operation: { type: "add", item: { id: "h", label: "happy", ref: "asset://h" } },
  }));
  expect(added.entity.body.pack.items.map((item) => item.id)).toEqual(["n", "h"]);
  expect(added.entity.body.groups).toEqual(before.body.groups);
  expect(added.entity.original).toEqual(before.original);
});

test("group lifecycle and group-targeted item edits are typed", () => {
  const before = pack();
  const renamed = groups.preview(before, groups.input.parse({
    target: { id: "faces" },
    operation: { type: "rename", id: "side", newId: "supporting" },
  }));
  const changed = items.preview(renamed.entity, items.input.parse({
    target: { id: "faces", groupId: "supporting" },
    operation: { type: "update", id: "s", patch: { label: "bright smile" } },
  }));
  expect(changed.entity.body.groups?.supporting?.items[0]?.label).toBe("bright smile");
  expect(changed.entity.body.groups?.side).toBeUndefined();
});
