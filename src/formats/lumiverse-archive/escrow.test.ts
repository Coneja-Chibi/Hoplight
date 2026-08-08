/**
 * The one contract that matters here: the archive's own twin never displaces the codec's. A
 * character or persona already comes back from its Lumiverse codec with `original["lumiverse-*"]`
 * set, and addArchiveEscrow has to add beside it, not instead of it.
 */
import { describe, expect, test } from "bun:test";
import { primaryOriginalRaw, type CanonicalEntity } from "../../core/canonical";
import { personaRow } from "../_fixtures/lumiverse-archive/rows";
import { addArchiveEscrow } from "./escrow";

interface FixtureBody {
  name: string;
}

/** Stands in for whatever a dispatched codec already returned, twin and all. */
const dispatched = (): CanonicalEntity<"persona", FixtureBody> => ({
  schemaVersion: "1",
  kind: "persona",
  id: "test-persona-alpha",
  body: { name: "Test Persona Alpha" },
  original: { "lumiverse-persona": { raw: { name: "Test Persona Alpha", source: "codec" } } },
});

describe("addArchiveEscrow", () => {
  test("the codec's twin stays first, the archive twin lands after it", () => {
    const row = personaRow();
    const entity = addArchiveEscrow(dispatched(), "personas", row);

    expect(Object.keys(entity.original!)).toEqual(["lumiverse-persona", "lumiverse-archive"]);
    // primaryOriginalRaw reads the first entry, so it must still be the codec's own twin
    expect(primaryOriginalRaw(entity.original)).toEqual({
      name: "Test Persona Alpha",
      source: "codec",
    });
  });

  test("the archive twin carries the row verbatim, doubly encoded JSON strings and all", () => {
    const row = personaRow();
    const entity = addArchiveEscrow(dispatched(), "personas", row);

    const archived = entity.original!["lumiverse-archive"]!;
    expect(archived.raw).toBe(row);
    // metadata is still a JSON-in-a-string column here, not the second-parsed value
    expect(typeof (archived.raw as Record<string, unknown>).metadata).toBe("string");
    expect(archived.unmapped).toEqual({ table: "personas" });
  });

  test("an entity with no prior original still gets the archive twin, alone", () => {
    const bare: CanonicalEntity<"persona", FixtureBody> = {
      schemaVersion: "1",
      kind: "persona",
      id: "test-persona-bare",
      body: { name: "Bare" },
    };
    const entity = addArchiveEscrow(bare, "personas", personaRow());
    expect(Object.keys(entity.original!)).toEqual(["lumiverse-archive"]);
  });
});
