/**
 * M0 foundation jewel: PNG carrier + JSON V2 round-trip (Round-Trip Law core).
 */
import { test, expect } from "bun:test";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import encodePng from "png-chunks-encode";
import { characterAdapter as st, embedCharacterJson } from "./formats/sillytavern/index";

function makeCarrierPng(): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, 1);
  dv.setUint32(4, 1);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = new Uint8Array(deflateSync(new Uint8Array([0, 0, 0, 0, 0])));
  return encodePng([
    { name: "IHDR", data: ihdr },
    { name: "IDAT", data: idat },
    { name: "IEND", data: new Uint8Array(0) },
  ]);
}

const v2 = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "M0 Alice",
    description: "foundation fixture",
    personality: "steady",
    scenario: "lab",
    first_mes: "Hello.",
    mes_example: "",
    creator_notes: "",
    tags: ["m0"],
    creator: "vaud",
    character_version: "1.0",
    alternate_greetings: [],
    extensions: { talkativeness: "0.5" },
  },
};

test("M0: V2 JSON lossless open/export", () => {
  const ent = st.toCanonical({ text: JSON.stringify(v2) });
  expect(ent.body.identity.name).toBe("M0 Alice");
  const back = JSON.parse(st.fromCanonical(ent).text!);
  expect(back).toEqual(v2);
});

test("M0: V2 PNG chara chunk open + name survives", () => {
  const png = embedCharacterJson(makeCarrierPng(), JSON.stringify(v2));
  const ent = st.toCanonical({ bytes: png });
  expect(ent.body.identity.name).toBe("M0 Alice");
  expect(ent.body.settings?.talkativeness).toBe(0.5);
});

test("M0: real Seraphina.png extensions bag unedited round-trip", () => {
  const path = join(import.meta.dir, "../samples/sillytavern/Seraphina.png");
  const bytes = new Uint8Array(readFileSync(path));
  const ent = st.toCanonical({ bytes, filename: "Seraphina.png" });
  expect(ent.body.identity.name.length).toBeGreaterThan(0);
  const raw = ent.original?.sillytavern?.raw as { data?: { extensions?: unknown } };
  const before = raw?.data?.extensions;
  expect(before).toBeDefined();
  const out = st.fromCanonical(ent);
  // JSON path: re-parse from text if adapter emits json
  if (out.text) {
    const wire = JSON.parse(out.text);
    expect(wire.data.extensions).toEqual(before);
  }
});
