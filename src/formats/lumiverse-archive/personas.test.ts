/**
 * The persona slice: a row becomes a real CanonicalPersona through the existing Lumiverse persona
 * codec, its attached lorebook resolves to whatever actually landed in Hoplight (or is dropped, not
 * left dangling), its avatar resolves to a data: URI or is cleared, and a broken metadata column
 * never blocks import since nothing in the codec's mapping reads it.
 */
import { describe, expect, test } from "bun:test";
import {
  PNG_1X1,
  assembleLvbak,
  buildBadRowsLvbak,
  buildCrossLinksLvbak,
  buildMinimalLvbak,
  buildMissingBinariesLvbak,
  lvbakManifest,
  lvbakStats,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import {
  DANGLING_ID,
  PERSONA_AVATAR,
  PERSONA_ID,
  WORLD_BOOK_ID,
  personaRow,
} from "../_fixtures/lumiverse-archive/rows";
import { createBinaries } from "./binaries";
import { createIdMint, createLinkMap } from "./links";
import { importLorebooks } from "./lorebooks";
import { ndjsonLineCeiling } from "./ndjson";
import { importPersonas, personaRowToWire } from "./personas";
import { createLvbakReport } from "./report";
import { readTable, type TableRow } from "./table-walk";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);
const PNG_DATA_URI = `data:image/png;base64,${Buffer.from(PNG_1X1).toString("base64")}`;

/** Read one real personas row through readTable, the shape personaRowToWire actually consumes. */
async function firstPersonaRead(bytes: Uint8Array): Promise<TableRow> {
  const source = zipEntrySource(bytes);
  for await (const read of readTable(source, "personas", {
    lineCeiling: V1_CEILING,
    onFailure: () => expect.unreachable(),
  })) {
    return read;
  }
  throw new Error("fixture carries no personas row");
}

describe("personaRowToWire", () => {
  test("0/1 ints become booleans and metadata is substituted with the parsed object", async () => {
    const read = await firstPersonaRead(buildMinimalLvbak());
    const wire = personaRowToWire(read);
    expect(wire.is_narrator).toBe(false);
    expect(wire.is_default).toBe(true);
    expect(wire.metadata).toEqual({ source: "fixture" });
    expect(wire.name).toBe("Test Persona Alpha");
    expect(wire.subjective_pronoun).toBe("they");
    // the raw string is what escrow needs; the wire carries the PARSED value instead
    expect(typeof wire.metadata).not.toBe("string");
  });

  test("is_narrator/is_default tolerate a genuine true/false, not just SQLite's 0/1", async () => {
    const read = await firstPersonaRead(buildMinimalLvbak());
    const wire = personaRowToWire({ ...read, row: { ...read.row, is_narrator: true, is_default: false } });
    expect(wire.is_narrator).toBe(true);
    expect(wire.is_default).toBe(false);
  });

  test("a metadata parse failure leaves metadata off the wire rather than passing the broken string", async () => {
    const source = zipEntrySource(buildBadRowsLvbak());
    let broken: TableRow | undefined;
    for await (const r of readTable(source, "personas", {
      lineCeiling: V1_CEILING,
      onFailure: () => expect.unreachable(),
    })) {
      if (r.row.name === "Test Persona Broken") broken = r;
    }
    expect(broken).toBeDefined();
    const wire = personaRowToWire(broken!);
    expect("metadata" in wire).toBe(true);
    expect(wire.metadata).toBeUndefined();
  });
});

describe("importPersonas: attached lorebook", () => {
  test("hit: attached_world_book_id resolves to the actually-imported book's id", async () => {
    const bytes = buildCrossLinksLvbak();
    const report = createLvbakReport();
    const links = createLinkMap();
    const idMint = createIdMint(); // one shared mint, same as a real run threads across kind stages
    const source1 = zipEntrySource(bytes);
    const books = await importLorebooks(source1, { lineCeiling: V1_CEILING, report, links, idMint });
    expect(books).toHaveLength(1);
    const book = books[0]!;

    const source2 = zipEntrySource(bytes);
    const binaries = createBinaries(source2, await source2.list(), report);
    const personas = await importPersonas(source2, { lineCeiling: V1_CEILING, report, links, binaries, idMint });

    expect(personas).toHaveLength(1);
    const persona = personas[0]!;
    if (persona.kind !== "persona") throw new Error("unreachable");
    expect(persona.body.knowledgeRefs).toEqual([book.id]);
    // escrow keeps the RAW Lumiverse id, never the resolved one, on both twins
    expect(persona.original!["lumiverse-persona"]!.raw).toMatchObject({
      attached_world_book_id: WORLD_BOOK_ID,
    });
    expect(persona.original!["lumiverse-archive"]!.raw).toMatchObject({
      attached_world_book_id: WORLD_BOOK_ID,
    });
    expect(report.imported.persona).toEqual([{ id: persona.id, name: "Test Persona Alpha" }]);
  });

  test("miss: a dangling attached_world_book_id is dropped, and both sides are named in the report", async () => {
    const tables = { personas: [personaRow({ attached_world_book_id: DANGLING_ID })] };
    const bytes = assembleLvbak({ manifest: lvbakManifest(), tables, stats: lvbakStats(tables) });
    const report = createLvbakReport();
    const links = createLinkMap(); // deliberately empty: no book was ever imported
    const source = zipEntrySource(bytes);
    const binaries = createBinaries(source, await source.list(), report);

    const personas = await importPersonas(source, { lineCeiling: V1_CEILING, report, links, binaries, idMint: createIdMint() });
    expect(personas).toHaveLength(1);
    const persona = personas[0]!;
    if (persona.kind !== "persona") throw new Error("unreachable");
    expect(persona.body.knowledgeRefs).toBeUndefined();

    expect(report.unresolvedLinks).toHaveLength(1);
    const link = report.unresolvedLinks[0]!;
    expect(link.from).toContain("personas/");
    expect(link.from).toContain(PERSONA_ID);
    expect(link.to).toBe(`world_books/${DANGLING_ID}`);
  });
});

describe("importPersonas: avatar", () => {
  test("hit: avatar_path resolves to a data: URI in presentation.imageUrl", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const binaries = createBinaries(source, await source.list(), report);

    const personas = await importPersonas(source, { lineCeiling: V1_CEILING, report, links, binaries, idMint: createIdMint() });
    const persona = personas[0]!;
    if (persona.kind !== "persona") throw new Error("unreachable");
    expect(persona.body.presentation?.imageUrl).toBe(PNG_DATA_URI);
    // the raw path, not the data URI, is what the escrow twins keep
    expect(persona.original!["lumiverse-persona"]!.raw).toMatchObject({ avatar_path: PERSONA_AVATAR });
    expect(report.missingBinaries).toEqual([]);
  });

  test("miss: an absent avatar file still imports the persona, with the miss recorded", async () => {
    const source = zipEntrySource(buildMissingBinariesLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const binaries = createBinaries(source, await source.list(), report);

    const personas = await importPersonas(source, { lineCeiling: V1_CEILING, report, links, binaries, idMint: createIdMint() });
    expect(personas).toHaveLength(1);
    const persona = personas[0]!;
    if (persona.kind !== "persona") throw new Error("unreachable");
    expect(persona.body.presentation?.imageUrl).toBeUndefined();
    expect(report.missingBinaries).toContain(`files/avatars/${PERSONA_AVATAR}`);
  });
});

describe("importPersonas: metadata never gates", () => {
  test("a persona whose metadata will not parse still imports, unrecorded as a failure", async () => {
    const source = zipEntrySource(buildBadRowsLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const binaries = createBinaries(source, await source.list(), report);

    const personas = await importPersonas(source, { lineCeiling: V1_CEILING, report, links, binaries, idMint: createIdMint() });
    expect(personas).toHaveLength(2);
    const names = personas.map((p) => (p.kind === "persona" ? p.body.name : ""));
    expect(names.sort()).toEqual(["Test Persona Alpha", "Test Persona Broken"]);
    expect(report.failed.filter((f) => f.table === "personas")).toEqual([]);
    expect(report.imported.persona).toHaveLength(2);
  });
});
