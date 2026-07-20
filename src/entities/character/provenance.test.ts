/** Regression coverage for the provenance.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import { labelCard, sniffContainer } from "./provenance";

const v3 = (data: Record<string, unknown>) => ({ spec: "chara_card_v3", spec_version: "3.0", data });
const v2 = (data: Record<string, unknown>) => ({ spec: "chara_card_v2", spec_version: "2.0", data });

test("labels a RoleCall v3 card by its rolecall namespace", () => {
  const l = labelCard(v3({ name: "A", first_mes: "hi", extensions: { rolecall: { id: "x" } } }), "json");
  expect(l.format).toBe("chara_card_v3");
  expect(l.container).toBe("json");
  expect(l.likelyOrigin).toBe("RoleCall");
  expect(l.confidence).toBeGreaterThan(0.9);
  expect(l.signals).toContain("extensions.rolecall");
});

test("labels a Risu card, and Risu outranks the weak SillyTavern guess when both fingerprints are present", () => {
  const l = labelCard(v3({ name: "V", first_mes: "hm", extensions: { risuai: {}, depth_prompt: {} } }), "charx");
  expect(l.likelyOrigin).toBe("RisuAI");
  expect(l.container).toBe("charx");
  // both fired; the stronger one wins but transparency keeps both signals
  expect(l.signals).toContain("extensions.risuai");
  expect(l.signals).toContain("sillytavern-extension-keys");
});

test("labels a native Agnai card by shape (no namespace needed)", () => {
  const l = labelCard({ kind: "character", persona: { kind: "wpp", attributes: {} }, greeting: "yo" });
  expect(l.format).toBe("agnai");
  expect(l.likelyOrigin).toBe("Agnai");
});

test("labels a legacy Backyard/Faraday flat card by its native shape", () => {
  const l = labelCard({ aiName: "Vera", aiPersona: "a cartographer" });
  expect(l.format).toBe("backyard");
  expect(l.likelyOrigin).toBe("Backyard AI (Faraday)");
});

test("a plain Tavern card carrying only ST keys is a weak SillyTavern guess", () => {
  const l = labelCard(v2({ name: "A", first_mes: "hi", extensions: { talkativeness: "0.5" } }));
  expect(l.format).toBe("chara_card_v2");
  expect(l.likelyOrigin).toBe("SillyTavern");
  expect(l.confidence).toBeLessThan(0.6);
});

test("a bare V1 card has a format but no discernible origin", () => {
  const l = labelCard({ name: "A", first_mes: "hi" });
  expect(l.format).toBe("chara_card_v1");
  expect(l.likelyOrigin).toBeUndefined();
  expect(l.confidence).toBe(0);
  expect(l.signals).toEqual([]);
});

test("junk input never throws: unknown format, unknown container, no origin", () => {
  for (const junk of [null, "not json", 42, [], {}]) {
    const l = labelCard(junk);
    expect(l.format).toBe("unknown");
    expect(l.likelyOrigin).toBeUndefined();
  }
});

test("sniffContainer reads the wrapper from raw bytes/text", () => {
  expect(sniffContainer({ bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]) })).toBe("png");
  expect(sniffContainer({ bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]) })).toBe("charx");
  expect(sniffContainer({ text: "{}" })).toBe("json");
  // a real .json read carries BOTH bytes and decoded text; the non-binary bytes must not swallow it
  expect(sniffContainer({ bytes: new Uint8Array([0x7b, 0x7d]), text: "{}" })).toBe("json");
  expect(sniffContainer({ bytes: new Uint8Array([1, 2, 3]) })).toBe("unknown");
});
