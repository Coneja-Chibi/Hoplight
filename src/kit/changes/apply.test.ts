/** One-shot apply, stale refusal, and post-save verification coverage. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLorebookBody } from "../../core/lore";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { KitBridge } from "../bridge";
import { discoverCapabilities } from "../capabilities/discover";
import { applyChangeDraft } from "./apply";
import { createChangeSession } from "./session";

const baseline = (): ParsedCanonicalEntity => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "lorebook",
  id: "world",
  body: emptyLorebookBody("World"),
});

async function drafted() {
  const entity = baseline();
  const capability = (await discoverCapabilities())
    .find((candidate) => candidate.id === "lorebook.settings.update")!;
  const changes = createChangeSession();
  const draft = changes.draft(capability, {
    target: { id: entity.id },
    patch: { name: "Aetheria" },
  }, entity);
  return { changes, draft };
}

const bridgeBase = (): KitBridge => ({
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read() { return null; },
  async save() { throw new Error("unexpected save"); },
  async delete() { return false; },
});

describe("applyChangeDraft", () => {
  test("saves once, verifies, and refuses a second apply", async () => {
    const { changes, draft } = await drafted();
    let current = baseline();
    let saves = 0;
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndSave(raw) {
        saves += 1;
        current = structuredClone(raw as ParsedCanonicalEntity);
        return { status: "saved", summary: { id: "world", kind: "lorebook", name: "Aetheria" } };
      },
      async read() { return current; },
    };

    const first = await applyChangeDraft(changes, bridge, draft.id);
    const second = await applyChangeDraft(changes, bridge, draft.id);
    expect(first.status).toBe("applied");
    expect(first.detail).toContain("verified");
    expect(second.status).toBe("failed");
    expect(saves).toBe(1);
  });

  test("a stale revision performs no save and reports stale", async () => {
    const { changes, draft } = await drafted();
    let attempts = 0;
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndSave() {
        attempts += 1;
        return { status: "stale" };
      },
    };
    const result = await applyChangeDraft(changes, bridge, draft.id);
    expect(result.status).toBe("stale");
    expect(result.detail).toContain("nothing was written");
    expect(attempts).toBe(1);
  });

  test("a post-save mismatch cannot produce an applied receipt", async () => {
    const { changes, draft } = await drafted();
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndSave() {
        return { status: "saved", summary: { id: "world", kind: "lorebook", name: "wrong" } };
      },
      async read() { return baseline(); },
    };
    const result = await applyChangeDraft(changes, bridge, draft.id);
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("verification did not match");
  });
});
