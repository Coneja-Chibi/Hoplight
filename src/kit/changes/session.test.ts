/** Draft composition and canonical-invariant coverage for Kit change sessions. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLorebookBody } from "../../core/lore";
import type { CanonicalLorebook } from "../../entities/lorebook/schema";
import { discoverCapabilities } from "../capabilities/discover";
import { createChangeSession } from "./session";

const entity = (): CanonicalLorebook => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "lorebook",
  id: "world",
  body: emptyLorebookBody("World"),
  original: {
    sillytavern: {
      raw: { entries: { "0": { content: "source twin" } } },
      unmapped: { privateField: "sealed" },
    },
  },
});

describe("ChangeSession", () => {
  test("composes multiple semantic operations into one draft for one target", async () => {
    const catalog = await discoverCapabilities();
    const update = catalog.find((capability) => capability.id === "lorebook.entries.update")!;
    const settings = catalog.find((capability) => capability.id === "lorebook.settings.update")!;
    const original = entity();
    const entryId = original.body.entries[0]!.id;
    const changes = createChangeSession();

    const first = changes.draft(update, {
      target: { id: original.id },
      entryId,
      patch: { title: "Dragon" },
    }, original);
    const second = changes.draft(settings, {
      target: { id: original.id },
      patch: { name: "Aetheria" },
    }, original);

    expect(second.id).toBe(first.id);
    expect(second.operations).toHaveLength(2);
    expect((second.proposed.body as typeof original.body).name).toBe("Aetheria");
    expect((second.proposed.body as typeof original.body).entries[0]!.title).toBe("Dragon");
    expect((second.baseline.body as typeof original.body).name).toBe("World");
  });

  test("preserves escrow and rejects target identity changes", async () => {
    const [update] = (await discoverCapabilities())
      .filter((capability) => capability.id === "lorebook.entries.update");
    const original = entity();
    const changes = createChangeSession();
    const draft = changes.draft(update!, {
      target: { id: original.id },
      entryId: original.body.entries[0]!.id,
      patch: { content: "Changed canonical content" },
    }, original);

    expect(draft.proposed.original).toEqual(original.original);
    expect(() => changes.draft(update!, {
      target: { id: "other" },
      entryId: original.body.entries[0]!.id,
      patch: { title: "Nope" },
    }, original)).toThrow("target id");
  });

  test("discards a draft exactly once", async () => {
    const [update] = (await discoverCapabilities())
      .filter((capability) => capability.id === "lorebook.entries.update");
    const original = entity();
    const changes = createChangeSession();
    const draft = changes.draft(update!, {
      target: { id: original.id },
      entryId: original.body.entries[0]!.id,
      patch: { title: "Dragon" },
    }, original);

    expect(changes.discard(draft.id)?.status).toBe("discarded");
    expect(changes.discard(draft.id)).toBeNull();
    expect(changes.forTarget("lorebook", original.id)).toBeNull();
  });
});
