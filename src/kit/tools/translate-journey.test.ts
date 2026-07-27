/**
 * "Make my RoleCall preset into a SillyTavern preset", all the way through: a preset carrying block
 * notation, RoleCall separators, engine-only macros and the range/list trap goes in, and a
 * SillyTavern preset file comes out with the macros actually translated.
 *
 * The assertions that matter are the ones about not betraying the author: prose inside a flattened
 * block survives, and a macro whose meaning changes is never emitted silently as if it were fine.
 */
import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyPresetBody } from "../../entities/preset";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { StudioExports } from "../../studio/exports";
import type { KitBridge, KitEntity } from "../bridge";
import exportPiece from "./export";
import macroLookup from "./macro-lookup";

const root = await mkdtemp(join(tmpdir(), "hoplight-journey-"));
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const block = (id: string, content: string): unknown => ({
  id,
  name: id,
  content,
  role: "system",
  enabled: true,
  systemPrompt: false,
  marker: false,
  placement: "relative",
  injectionDepth: 4,
  injectionOrder: 100,
  forbidOverrides: false,
});

/** A RoleCall preset, escrow-tagged as such, using the dialect features ST does not share. */
const PRESET = parseCanonicalEntity({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset",
  id: "mythic",
  body: {
    ...emptyPresetBody("Mythic prose"),
    prompts: [
      block("Mood", "{{if {{getvar::mood}}}}You feel {{getvar::mood}} today.{{else}}Neutral.{{/if}}"),
      block("Dice", "Roll {{roll::2d6}} at {{datetimeformat::HH:mm}}."),
      block("Meta", "By {{charCreator}}. Theme {{accentColor}}. Pick {{random::1::10}}."),
    ],
  },
  original: { "rolecall-preset": { raw: { name: "Mythic prose" } } },
}) as unknown as KitEntity;

const bridge: KitBridge = {
  studioDir: root,
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind: string, id: string) {
    return kind === "preset" && id === "mythic" ? PRESET : null;
  },
  async save() { throw new Error("export must not touch canonical storage"); },
  async delete() { throw new Error("export must not delete"); },
};

test("a RoleCall preset exports as a SillyTavern preset with its macros translated", async () => {
  const result = await exportPiece.execute(
    { kind: "preset", id: "mythic", to: "sillytavern-preset" },
    { bridge, exports: new StudioExports(root) },
  );
  expect(result.outcome).toBe("applied");

  const receipt = JSON.parse(result.output) as {
    path: string;
    dialect: { from: string; to: string };
    translated: { kind: string; from: string; to: string | null; why: string }[];
    needsReview: { kind: string; from: string; candidates?: string[] }[];
  };
  expect(receipt.dialect).toEqual({ from: "rolecall", to: "sillytavern" });

  const file = await readFile(receipt.path, "utf8");
  const written = JSON.parse(file) as { prompts: { name: string; content: string }[] };
  const byName = new Map(written.prompts.map((p) => [p.name, p.content]));

  // 1. SillyTavern has conditionals, so the block survives intact rather than being flattened.
  // Flattening here would drop a working condition and keep one branch.
  const mood = byName.get("Mood") ?? "";
  expect(mood).toContain("You feel {{getvar::mood}} today.");
  expect(mood).toContain("{{if ");
  expect(mood).toContain("{{/if}}");
  expect(mood).toContain("{{else}}");

  // 2. Separators were rewritten into the forms SillyTavern actually parses.
  const dice = byName.get("Dice") ?? "";
  expect(dice).toContain("{{roll:2d6}}");
  expect(dice).toContain("{{datetimeformat HH:mm}}");
  expect(dice).not.toContain("::");

  // 3. The trap macro is still present but reported for review, never quietly blessed.
  const meta = byName.get("Meta") ?? "";
  expect(meta).toContain("{{random::1::10}}");
  const collision = receipt.needsReview.find((c) => c.kind === "collision");
  expect(collision?.from).toBe("{{random::1::10}}");
  expect(collision?.candidates).toContain("{{pick::a::b}}");

  // 4. Engine-only macros are gone from the artifact and accounted for in the receipt.
  expect(meta).not.toContain("accentColor");
  expect(meta).not.toContain("charCreator");
  expect(receipt.translated.some((c) => c.kind === "absent" && c.from === "{{accentColor}}")).toBe(true);
  expect(receipt.translated.some((c) => c.kind === "absent" && c.from === "{{charCreator}}")).toBe(true);

  // 5. Nothing changed without a stated reason.
  for (const change of receipt.translated) expect(change.why.length).toBeGreaterThan(10);
});

test("macro_lookup answers the equivalence question without the model guessing", async () => {
  const trap = await macroLookup.execute(
    { action: "equivalent", engine: "rolecall", target: "sillytavern", macro: "{{random::1::10}}" },
    { bridge },
  );
  const answer = JSON.parse(trap.output) as { verdict: string; why: string; candidates: string[] };
  expect(answer.verdict).toBe("collision");
  expect(answer.why).toContain("random.range");
  expect(answer.candidates.length).toBeGreaterThan(0);

  const clean = await macroLookup.execute(
    { action: "equivalent", engine: "rolecall", target: "sillytavern", macro: "{{char}}" },
    { bridge },
  );
  expect(JSON.parse(clean.output).verdict).toBe("portable");

  const mechanical = await macroLookup.execute(
    { action: "equivalent", engine: "rolecall", target: "sillytavern", macro: "roll" },
    { bridge },
  );
  const rolled = JSON.parse(mechanical.output) as { verdict: string; rewritten: string };
  expect(rolled.verdict).toBe("portable");
  expect(rolled.rewritten).toBe("{{roll:NdM}}");
});
