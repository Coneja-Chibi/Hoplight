/**
 * The journey this whole surface exists for: a RoleCall preset asked to become a SillyTavern preset,
 * end to end through the real adapter registry. The unit tests beside this one cover the rejection
 * branches with a fake bridge; this one proves the tool actually wires the conversion graph, the
 * serialize report, and the macro check together on the happy path.
 *
 * It lives in its own file on purpose. Loading every format adapter is real work, and folding that
 * cost into a broad test file was already shown to disturb timing-sensitive neighbours.
 */
import { expect, test } from "bun:test";
import { emptyPresetBody } from "../../entities/preset";
import { emptyLorebookBody } from "../../core/lore";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import type { KitBridge, KitEntity } from "../bridge";
import transfer from "./transfer";

/** A RoleCall-sourced preset carrying one macro SillyTavern has no name for. */
const PRESET = parseCanonicalEntity({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset",
  id: "mythic",
  body: {
    ...emptyPresetBody("Mythic prose"),
    prompts: [
      {
        id: "main",
        name: "Main",
        content: "You are {{char}}. Credit: {{charCreator}}.",
        role: "system",
        enabled: true,
        systemPrompt: false,
        marker: false,
        placement: "relative",
        injectionDepth: 4,
        injectionOrder: 100,
        forbidOverrides: false,
      },
    ],
  },
}) as unknown as KitEntity;

const bridge: KitBridge = {
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind: string, id: string) {
    return kind === "preset" && id === "mythic" ? PRESET : null;
  },
  async save() { throw new Error("transfer must not write to the studio"); },
  async delete() { throw new Error("transfer must not delete"); },
};

test("a RoleCall preset converts to a SillyTavern preset and reports the macro that dies", async () => {
  const result = await transfer.execute(
    { kind: "preset", id: "mythic", to: "sillytavern-preset" },
    { bridge },
  );

  const observed = JSON.parse(result.output) as {
    to: string;
    loss: { counts: { warnings: number; dropped: number | null } };
    macros: {
      checked: boolean;
      target: string;
      findings: { token: string; status: string; where: string }[];
      limits: string[];
    };
    payload: { content?: string; spilled?: boolean };
    note: string;
  };

  expect(observed.to).toBe("sillytavern-preset");
  expect(observed.loss).toBeDefined();

  // The macro check ran against SillyTavern's own catalog and found the RoleCall-only token.
  expect(observed.macros.checked).toBe(true);
  expect(observed.macros.target).toBe("sillytavern");
  expect(observed.macros.findings.map((f) => f.token)).toEqual(["{{charCreator}}"]);
  expect(observed.macros.findings[0]?.status).toBe("dies");
  expect(observed.macros.findings[0]?.where).toBe("Main");

  // {{char}} survives, so it must NOT be reported, and the caveat still travels with the result.
  expect(observed.macros.findings.some((f) => f.token === "{{char}}")).toBe(false);
  expect(observed.macros.limits.join(" ")).toContain("{{random::a::b}}");

  // The converted payload came back, and the summary counts the dead macro.
  expect(typeof observed.payload.content).toBe("string");
  expect(result.summary).toContain("1 dead macros");
  expect(observed.note).toContain("Nothing was written");
});

test("a lorebook transfer reports no macro section rather than an empty one", async () => {
  const book = parseCanonicalEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "lorebook",
    id: "world",
    body: emptyLorebookBody("World Bible"),
  }) as unknown as KitEntity;
  const loreBridge: KitBridge = {
    ...bridge,
    async read(kind: string, id: string) {
      return kind === "lorebook" && id === "world" ? book : null;
    },
  };

  const result = await transfer.execute(
    { kind: "lorebook", id: "world", to: "sillytavern-lorebook" },
    { bridge: loreBridge },
  );
  const observed = JSON.parse(result.output) as { macros?: unknown };
  expect(observed.macros).toBeUndefined();
  expect(result.summary).not.toContain("dead macros");
});
