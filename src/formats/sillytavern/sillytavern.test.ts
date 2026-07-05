import { test, expect } from "bun:test";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import encodePng from "png-chunks-encode";
import { characterAdapter as adapter, embedCharacterJson } from "./index";

// Build a valid 1x1 RGBA PNG carrier. png-chunks-encode computes correct CRCs for us.
function makeCarrierPng(): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, 1); // width
  dv.setUint32(4, 1); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const idat = new Uint8Array(deflateSync(new Uint8Array([0, 0, 0, 0, 0])));
  return encodePng([
    { name: "IHDR", data: ihdr },
    { name: "IDAT", data: idat },
    { name: "IEND", data: new Uint8Array(0) },
  ]);
}

const v2card = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Alice",
    description: "a curious girl",
    personality: "inquisitive",
    scenario: "wonderland",
    first_mes: "Hello there!",
    mes_example: "<START>",
    creator_notes: "a test card",
    tags: ["fantasy"],
    creator: "ada",
    character_version: "1.0",
    alternate_greetings: ["Hi again"],
    // foreign extensions that must survive the round-trip untouched
    extensions: { talkativeness: "0.5", depth_prompt: { prompt: "stay in character", depth: 4 } },
  },
};

test("detects and reads a V2 card JSON into the canonical model", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v2card) });
  expect(c.kind).toBe("character");
  expect(c.body.identity.name).toBe("Alice");
  expect(c.body.persona.personality).toBe("inquisitive");
  expect(c.body.greetings.firstMessage).toBe("Hello there!");
  expect(c.body.greetings.alternateGreetings).toEqual([{ text: "Hi again" }]);
  expect(c.body.discovery.tags).toEqual(["fantasy"]);
  expect(c.escrow?.sillytavern?.raw).toBeDefined();
});

test("reads a V2 card embedded in a PNG (chara chunk)", () => {
  const png = embedCharacterJson(makeCarrierPng(), JSON.stringify(v2card));
  const c = adapter.toCanonical({ bytes: png });
  expect(c.body.identity.name).toBe("Alice");
  expect(c.body.persona.scenario).toBe("wonderland");
});

test("round-trips a V2 card losslessly, foreign extensions survive", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v2card) });
  const out = adapter.fromCanonical(c);
  const back = JSON.parse(out.text ?? "");
  expect(back).toEqual(v2card);
});

// --- De-escrow: authored `extensions` fields are first-class editable slots, not opaque escrow. ---

test("de-escrow read: authored extensions land in first-class canonical slots", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v2card) });
  expect(c.body.settings?.talkativeness).toBe(0.5); // "0.5" string -> number
  expect(c.body.prompts.depthInjections).toEqual([
    { text: "stay in character", depth: 4, origin: "depth_prompt" },
  ]);
});

// The load-bearing proof (per advisor): a passing round-trip is NOT enough - a stale twin value
// round-trips green while silently dropping an edit. Editing the canonical field MUST reach the wire.
test("de-escrow edit: mutating talkativeness/depth_prompt/world reaches the wire", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v2card) });
  c.body.settings = { talkativeness: 0.9 };
  const inj = c.body.prompts.depthInjections?.[0];
  if (!inj) throw new Error("test setup: expected a depth_prompt injection");
  inj.text = "NEVER break character";
  inj.depth = 6;
  c.body.worldName = "Narnia";
  const back = JSON.parse(adapter.fromCanonical(c).text ?? "");
  expect(back.data.extensions.talkativeness).toBe(0.9);
  expect(back.data.extensions.depth_prompt).toEqual({ prompt: "NEVER break character", depth: 6 });
  expect(back.data.extensions.world).toBe("Narnia");
});

test("detect scores a real card high and junk zero", () => {
  expect(adapter.detect({ text: JSON.stringify(v2card) })).toBeGreaterThan(0.5);
  expect(adapter.detect({ text: "not a card" })).toBe(0);
});

// A real V3 card, per the chara_card_v3 spec. RC's parser dropped these V3-only fields.
const v3card = {
  spec: "chara_card_v3",
  spec_version: "3.0",
  data: {
    name: "Luna",
    description: "moon sorceress",
    personality: "calm",
    scenario: "night",
    first_mes: "The moon watches.",
    mes_example: "",
    system_prompt: "",
    post_history_instructions: "",
    creator_notes: "a v3 card",
    tags: ["magic"],
    creator: "ada",
    character_version: "1.0",
    alternate_greetings: [],
    group_only_greetings: ["Evening, all."],
    nickname: "Lu",
    source: ["https://example.com/luna"],
    creation_date: 1700000000,
    modification_date: 1700000001,
    creator_notes_multilingual: { en: "hi", ja: "こんにちは" },
    extensions: {},
    assets: [{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }],
  },
};

test("reads V3-only fields that RoleCall's parser dropped", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v3card) });
  expect(c.body.identity.nickname).toBe("Lu");
  expect(c.body.attribution.source).toEqual(["https://example.com/luna"]);
  expect(c.body.attribution.createdAt).toBe(1700000000);
  expect(c.body.greetings.groupOnlyGreetings).toEqual([{ text: "Evening, all." }]);
  expect(c.body.attribution.creatorNotesMultilingual).toEqual({ en: "hi", ja: "こんにちは" });
});

test("round-trips a V3 card losslessly (V3 fields + assets survive)", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v3card) });
  const back = JSON.parse(adapter.fromCanonical(c).text ?? "");
  expect(back).toEqual(v3card);
});

test("maps CCv3 assets[] into canonical media (previously escrow-only)", () => {
  const c = adapter.toCanonical({ text: JSON.stringify(v3card) });
  expect(c.body.media.portrait).toEqual({
    role: "portrait",
    label: "main",
    ref: "ccdefault:",
    mime: "image/png",
    primary: true,
  });
});

// CCv1: a bare flat card (no spec wrapper, none of the V2 marker fields).
const v1card = {
  name: "Bo",
  description: "a gruff sailor",
  personality: "terse",
  scenario: "on the docks",
  first_mes: "What.",
  mes_example: "<START>",
};

test("detects and round-trips a bare V1 flat card, staying flat on the way out", () => {
  expect(adapter.detect({ text: JSON.stringify(v1card) })).toBeGreaterThan(0.5);
  const c = adapter.toCanonical({ text: JSON.stringify(v1card) });
  expect(c.body.identity.name).toBe("Bo");
  expect(c.body.persona.personality).toBe("terse");
  expect(c.body.greetings.firstMessage).toBe("What.");
  // a V1 card must not gain a spec/data wrapper on round-trip
  expect(JSON.parse(adapter.fromCanonical(c).text ?? "")).toEqual(v1card);
});

// Real corpus: the official SillyTavern default card (samples/sillytavern/Seraphina.png). Proves the
// de-escrow against a genuine export, not a hand-built fixture. See samples/sillytavern/SOURCES.md.
const seraphinaPng = new Uint8Array(
  readFileSync(join(import.meta.dir, "../../../samples/sillytavern/Seraphina.png")),
);

test("real Seraphina.png: authored extensions de-escrow to first-class slots", () => {
  const c = adapter.toCanonical({ bytes: seraphinaPng });
  expect(c.body.settings?.talkativeness).toBe(0.5);
  expect(c.body.worldName).toBe("Eldoria");
  // Seraphina's depth_prompt.prompt is "" (a default ST writes even when unset) -> no injection authored;
  // the depth/role config stays on the escrow twin. This case proves world/talkativeness, NOT depth_prompt.
  expect(c.body.prompts.depthInjections).toBeUndefined();
});

test("real Seraphina.png: unedited round-trip leaves the extensions bag byte-identical", () => {
  const c = adapter.toCanonical({ bytes: seraphinaPng });
  const raw = c.escrow?.sillytavern?.raw as { data?: { extensions?: unknown }; extensions?: unknown };
  const origExt = raw.data?.extensions ?? raw.extensions;
  const back = JSON.parse(adapter.fromCanonical(c).text ?? "");
  // pulling depth_prompt/world/talkativeness out to canonical must NOT perturb the twin when unedited
  expect(back.data.extensions).toEqual(origExt);
});
