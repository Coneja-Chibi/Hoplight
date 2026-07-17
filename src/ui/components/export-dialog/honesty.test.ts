/**
 * Export honesty pure core.
 */
import { test, expect } from "bun:test";
import {
  agnaiHonestyLines,
  backyardHonestyLines,
  behaviorFlagsFromBody,
  buildExportHonesty,
  byafHonestyLines,
  coverageCarries,
  knowledgeHonestyLines,
  lumiverseHonestyLines,
  mediaPackHonestyLines,
} from "./honesty";

test("coverageCarries respects prefixes", () => {
  expect(coverageCarries(["behavior"], "behavior.triggerScripts")).toBe(true);
  expect(coverageCarries(["identity"], "behavior")).toBe(false);
});

test("behaviorFlagsFromBody reads triggers and package", () => {
  const f = behaviorFlagsFromBody(
    { behavior: { triggerScripts: [{ event: "output", conditions: [], effects: [] }] } },
    true,
  );
  expect(f.hasTriggers).toBe(true);
  expect(f.hasPackage).toBe(true);
});

test("risu keeps behavior", () => {
  const h = buildExportHonesty({
    targetId: "risu",
    targetFriendly: "RisuAI",
    carries: ["behavior", "identity.name"],
    flags: {
      hasTriggers: true,
      hasRegex: false,
      hasVirtual: false,
      hasBackground: false,
      hasPackage: true,
      hasDefaultVars: true,
    },
  });
  expect(h.level).toBe("ok");
  expect(h.lines.some((l) => l.kind === "keep")).toBe(true);
});

test("sillytavern drops behavior with warn", () => {
  const h = buildExportHonesty({
    targetId: "sillytavern",
    targetFriendly: "SillyTavern",
    carries: ["identity.name", "persona.personality"],
    flags: {
      hasTriggers: true,
      hasRegex: false,
      hasVirtual: false,
      hasBackground: false,
      hasPackage: true,
      hasDefaultVars: false,
    },
  });
  expect(h.level).toBe("warn");
  expect(h.lines.some((l) => l.kind === "drop")).toBe(true);
});

test("agnaiHonestyLines flags titled greetings and multi insert", () => {
  const lines = agnaiHonestyLines({
    greetings: {
      alternateGreetings: [{ text: "hi", title: "Friendly" }],
    },
    prompts: {
      depthInjections: [
        { text: "a", depth: 1 },
        { text: "b", depth: 2 },
      ],
    },
  });
  expect(lines.some((l) => l.kind === "drop" && /titles/i.test(l.text))).toBe(true);
  expect(lines.some((l) => l.kind === "warn" && /insert/i.test(l.text))).toBe(true);
});

test("agnai export honesty attaches format caveats when body risks loss", () => {
  const h = buildExportHonesty({
    targetId: "agnai",
    targetFriendly: "Agnai",
    carries: ["identity.name", "persona.personality"],
    flags: {
      hasTriggers: false,
      hasRegex: false,
      hasVirtual: false,
      hasBackground: false,
      hasPackage: false,
      hasDefaultVars: false,
    },
    body: {
      greetings: { alternateGreetings: [{ text: "yo", title: "A" }] },
    },
  });
  expect(h.level).toBe("warn");
  expect(h.lines.some((l) => /titles/i.test(l.text))).toBe(true);
});

test("agnai export without risky body stays ok when no behavior", () => {
  const h = buildExportHonesty({
    targetId: "agnai",
    targetFriendly: "Agnai",
    carries: ["identity.name"],
    flags: {
      hasTriggers: false,
      hasRegex: false,
      hasVirtual: false,
      hasBackground: false,
      hasPackage: false,
      hasDefaultVars: false,
    },
    body: { identity: { name: "X" } },
  });
  expect(h.level).toBe("ok");
});

test("backyardHonestyLines drops alts and portrait on legacy json", () => {
  const lines = backyardHonestyLines({
    greetings: { alternateGreetings: [{ text: "hi" }] },
    media: { portrait: { ref: "data:image/png;base64,xx" } },
  });
  expect(lines.some((l) => l.kind === "drop" && /alternate/i.test(l.text))).toBe(true);
  expect(lines.some((l) => l.kind === "drop" && /portrait/i.test(l.text))).toBe(true);
});

test("knowledgeHonestyLines: ST/RC keep re-embed; lean targets warn", () => {
  const body = { knowledgeRefs: ["aetheria", "rules"] };
  const st = knowledgeHonestyLines("sillytavern", body);
  expect(st.some((l) => l.kind === "keep" && /2 linked lorebooks/i.test(l.text))).toBe(true);
  const lean = knowledgeHonestyLines("backyard", body);
  expect(lean.some((l) => l.kind === "warn")).toBe(true);
  expect(knowledgeHonestyLines("sillytavern", {})).toEqual([]);
});

test("byafHonestyLines warns on knowledgeRefs only (titled alts auto-split)", () => {
  const bare = byafHonestyLines({
    greetings: { alternateGreetings: [{ text: "hi", title: "Scene 2" }] },
  });
  expect(bare.some((l) => /titled|scenario/i.test(l.text))).toBe(false);

  const withLore = byafHonestyLines({ knowledgeRefs: ["book-1"] });
  expect(withLore.some((l) => l.kind === "warn" && /lore/i.test(l.text))).toBe(true);
});

test("lumiverseHonestyLines warns when extensions hold expressions", () => {
  const lines = lumiverseHonestyLines(
    {},
    { expressions: { enabled: true, mappings: { neutral: "i1" } } },
  );
  expect(lines.some((l) => l.kind === "warn" && /strips expressions/i.test(l.text))).toBe(true);
});

test("lumiverseHonestyLines keeps portable lora note", () => {
  const lines = lumiverseHonestyLines(
    {},
    { lumiverse_image_gen_lora: { version: 1, lora_filename: "x.safetensors", weight: 1 } },
  );
  expect(lines.some((l) => l.kind === "keep" && /LoRA/i.test(l.text))).toBe(true);
});

test("mediaPackHonestyLines: pack keep on ST, drop on Agnai", () => {
  const body = {
    media: {
      assets: [
        { role: "emotion", label: "happy", ref: "h" },
        { role: "emotion", label: "sad", ref: "s" },
      ],
    },
  };
  expect(mediaPackHonestyLines("sillytavern", body).some((l) => l.kind === "keep")).toBe(true);
  expect(mediaPackHonestyLines("agnai", body).some((l) => l.kind === "drop")).toBe(true);
});

test("mediaExportSummary chips: portrait + emotions", () => {
  const { mediaExportSummary } = require("./honesty") as typeof import("./honesty");
  const s = mediaExportSummary({
    media: {
      portrait: { role: "portrait", ref: "p", primary: true },
      assets: [{ role: "emotion", label: "a", ref: "1" }],
    },
  });
  expect(s.chips).toEqual(["portrait", "1 emotion"]);
});

test("backyard export honesty attaches caveats and partial headline", () => {
  const h = buildExportHonesty({
    targetId: "backyard",
    targetFriendly: "Backyard (legacy)",
    carries: ["identity.name"],
    flags: {
      hasTriggers: false,
      hasRegex: false,
      hasVirtual: false,
      hasBackground: false,
      hasPackage: false,
      hasDefaultVars: false,
    },
    body: {
      media: { portrait: { ref: "data:image/png;base64,xx" } },
    },
  });
  expect(h.level).toBe("warn");
  expect(h.headline).toMatch(/partial/i);
  expect(h.lines.some((l) => /byaf/i.test(l.text))).toBe(true);
});
