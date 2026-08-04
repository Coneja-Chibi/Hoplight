/** One-shot apply, stale refusal, and post-save verification coverage. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLorebookBody } from "../../core/lore";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { KitBridge } from "../bridge";
import { discoverCapabilities } from "../capabilities/discover";
import { applyChangeDraft } from "./apply";
import { createChangeSession, type ChangeSession } from "./session";
import type { ChangeDraft } from "./types";

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
  test("creates a new character once through the create-only bridge seam", async () => {
    const entity: ParsedCanonicalEntity = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: "eros",
      body: {
        identity: { name: "Eros" },
        persona: { personality: "Warm and impulsive." },
        prompts: {},
        greetings: {},
        examples: {},
        media: {},
        attribution: {},
        discovery: { tags: ["mythology"] },
      },
    };
    const changes = createChangeSession();
    const draft = changes.create(entity, {
      capabilityId: "studio.character.create",
      input: { name: "Eros" },
      changes: [{
        path: "/",
        label: "new character",
        before: null,
        after: "Eros",
      }],
      warnings: [],
      platformImpact: [],
    });
    let current: ParsedCanonicalEntity | null = null;
    let creates = 0;
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndCreate(raw) {
        creates += 1;
        current = structuredClone(raw as ParsedCanonicalEntity);
        return { status: "saved", summary: { id: "eros", kind: "character", name: "Eros" } };
      },
      async read() { return current; },
    };

    const first = await applyChangeDraft(changes, bridge, draft.id);
    const second = await applyChangeDraft(changes, bridge, draft.id);
    expect(first.status).toBe("applied");
    expect(second.status).toBe("failed");
    expect(creates).toBe(1);
  });

  test("saves once, verifies, and refuses a second apply", async () => {
    const { changes, draft } = await drafted();
    let current = baseline();
    let saves = 0;
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndSave(raw) {
        saves += 1;
        current = structuredClone(raw as ParsedCanonicalEntity);
        return { status: "saved", summary: { id: "world", kind: "lorebook", name: "Aetheria" }, revision: "next" };
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

  test("returned draft snapshots cannot mutate the session's proposed entity", async () => {
    const { changes, draft } = await drafted();
    (draft.proposed.body as { entries: unknown }).entries = "wrong";
    let saved: ParsedCanonicalEntity | null = null;
    let savedEntriesArray = false;
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndSave(raw) {
        saved = structuredClone(raw as ParsedCanonicalEntity);
        savedEntriesArray = Array.isArray((raw as ParsedCanonicalEntity & {
          body: { entries?: unknown };
        }).body.entries);
        return { status: "saved", summary: { id: "world", kind: "lorebook", name: "Aetheria" }, revision: "next" };
      },
      async read() { return saved; },
    };

    const result = await applyChangeDraft(changes, bridge, draft.id);
    expect(result.status).toBe("applied");
    expect(savedEntriesArray).toBe(true);
  });

  test("rejects a malformed stored draft before the apply or write seams", async () => {
    const { draft } = await drafted();
    const malformed = {
      ...draft,
      proposed: {
        ...draft.proposed,
        body: { ...draft.proposed.body, entries: "wrong" },
      },
    } as unknown as ChangeDraft;
    let starts = 0;
    let failures = 0;
    let writes = 0;
    const changes: ChangeSession = {
      create() { throw new Error("unexpected create"); },
      draft() { throw new Error("unexpected draft"); },
      revise() { throw new Error("unexpected revise"); },
      get() { return malformed; },
      list() { return [malformed]; },
      forTarget() { return malformed; },
      discard() { return null; },
      fail() {
        failures += 1;
        return { ...malformed, status: "failed" };
      },
      startApply() {
        starts += 1;
        return { ...malformed, status: "applying" };
      },
      finishApply() { return null; },
    };
    const bridge: KitBridge = {
      ...bridgeBase(),
      async compareAndSave() {
        writes += 1;
        return { status: "saved", summary: { id: "world", kind: "lorebook", name: "World" }, revision: "next" };
      },
    };

    const result = await applyChangeDraft(changes, bridge, malformed.id);
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("nothing was written");
    expect(starts).toBe(0);
    expect(writes).toBe(0);
    expect(failures).toBe(1);
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
        return { status: "saved", summary: { id: "world", kind: "lorebook", name: "wrong" }, revision: "next" };
      },
      async read() { return baseline(); },
    };
    const result = await applyChangeDraft(changes, bridge, draft.id);
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("verification did not match");
  });
});
