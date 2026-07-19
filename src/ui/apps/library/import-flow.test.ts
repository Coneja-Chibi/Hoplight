/**
 * annotateRead must pass adapter-produced canonical bodies through UNTOUCHED. Every ok inspect
 * result comes from a real format adapter (server-engine handleInspect), so "healing" here can only
 * destroy: the enumerated heal rebuild silently reset every canonical field outside its list -
 * caught live when a Marinara import arrived with its folders (categories) stripped.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalLorebook } from "../../../entities/lorebook/schema";
import marinaraLorebook from "../../../formats/marinara/lorebook";
import { annotateRead } from "./import-flow";

const FIXTURE = join(
  import.meta.dir,
  "../../../../samples/marinara/lorebooks/arcadia-world-lore.marinara.json",
);

describe("annotateRead", () => {
  test("keeps the codec body byte-identical: categories, positions, memberships survive", () => {
    const entity = marinaraLorebook.toCanonical({ text: readFileSync(FIXTURE, "utf8") });
    const out = annotateRead("arcadia.marinara.json", { ok: true, entity, kind: "lorebook" });
    const body = (out.result.entity as CanonicalLorebook).body;
    expect(body).toEqual(entity.body);
    expect((body.categories ?? []).map((c) => c.id)).toEqual(["folder-court", "folder-spies"]);
    expect(body.entries.find((e) => e.id === "e-oathbound-spies")!.categoryId).toBe("folder-spies");
    expect(out.entryCount).toBe(4);
  });

  test("related bundle lorebooks pass through untouched with a summed entry count", () => {
    const entity = marinaraLorebook.toCanonical({ text: readFileSync(FIXTURE, "utf8") });
    const out = annotateRead("card.png", {
      ok: true,
      entity: { kind: "character", body: {} },
      kind: "character",
      related: { lorebooks: [entity] },
    });
    const kept = (out.result.related?.lorebooks?.[0] as CanonicalLorebook).body;
    expect(kept).toEqual(entity.body);
    expect(out.entryCount).toBe(4);
  });
});
