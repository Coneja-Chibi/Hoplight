/**
 * Bundle save: lorebooks first, keep-both rewrite, partial failure honesty.
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import { StudioStore } from "./store";
import { preflightBundle, saveBundle } from "./bundle";

const char = (id: string, refs: string[] = []): CanonicalCharacter => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id,
  body: {
    identity: { name: id },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    attribution: {},
    discovery: {},
    media: {},
    knowledgeRefs: refs.length ? refs : undefined,
  },
  original: {},
});

const book = (id: string, name = id): CanonicalLorebook => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "lorebook",
  id,
  body: {
    name,
    tags: [],
    globalCaseSensitive: false,
    globalMatchWholeWords: false,
    globalScanDepth: 4,
    globalRecursion: false,
    tokenBudget: 0,
    budgetMode: "token",
    entryBudget: 0,
    entries: [
      {
        id: "e1",
        title: "Entry",
        content: "text",
        triggers: [{ keyword: "k", isRegex: false }],
        enabled: true,
        sortOrder: 0,
        constant: false,
        triggerMode: "simple",
        secondaryTriggers: [],
        selectiveLogic: "and_any",
        caseSensitive: null,
        matchWholeWords: null,
        scanDepth: null,
        position: "world",
        depth: 0,
        role: "system",
        priority: 100,
        sticky: 0,
        cooldown: 0,
        delay: 0,
        groupName: null,
        categoryId: null,
        groupWeight: 100,
        probability: 100,
        useMemo: false,
        excludeRecursion: false,
        preventRecursion: false,
        delayUntilRecursion: 0,
        characterFilter: null,
        scanCharacterDescription: false,
        scanCharacterPersonality: false,
        scanUserPersona: false,
        scanScenario: false,
        ignoreBudget: false,
        sideEffects: null,
      },
    ],
  },
  original: {},
});

describe("preflightBundle", () => {
  test("rejects missing id/kind", () => {
    expect(() => preflightBundle({ entity: { kind: "character" } as never })).toThrow(/id/);
  });
});

describe("saveBundle", () => {
  test("rejects a malformed related entity before writing the batch", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-bundle-preflight-"));
    const store = new StudioStore(dir);
    const malformed = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "lorebook",
      id: "broken",
      body: { name: "Broken" },
    } as CanonicalLorebook;

    await expect(saveBundle(store, {
      entity: char("aria"),
      lorebooks: [book("valid"), malformed],
    })).rejects.toThrow("bundle: invalid lorebook");
    expect(await store.list()).toEqual([]);
  });

  test("persists character and lorebook; knowledgeRefs match saved book id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-bundle-"));
    const store = new StudioStore(dir);
    const lb = book("aetheria-lore", "Aetheria");
    const c = char("aria", ["aetheria-lore"]);
    const result = await saveBundle(store, { entity: c, lorebooks: [lb] });
    expect(result.ok).toBe(true);
    expect(result.related).toHaveLength(1);
    expect(result.primary?.kind).toBe("character");
    expect(result.knowledgeRefs).toEqual([result.related[0]!.id]);

    const savedChar = await store.read("character", result.primary!.id);
    expect((savedChar!.body as { knowledgeRefs?: string[] }).knowledgeRefs).toEqual([
      result.related[0]!.id,
    ]);
    const savedBook = await store.read("lorebook", result.related[0]!.id);
    expect(savedBook).not.toBeNull();
    expect((savedBook!.body as { name?: string }).name).toBe("Aetheria");
  });

  test("keep-both collision rewrites each character to its actual book id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-bundle-col-"));
    const store = new StudioStore(dir);

    const first = await saveBundle(store, {
      entity: char("aria", ["shared-book"]),
      lorebooks: [book("shared-book", "First")],
    });
    expect(first.ok).toBe(true);
    const firstBookId = first.related[0]!.id;
    expect(firstBookId).toBe("shared-book");

    const second = await saveBundle(store, {
      entity: char("aria", ["shared-book"]),
      lorebooks: [book("shared-book", "Second")],
    });
    expect(second.ok).toBe(true);
    // keep-both: second book and character get -2 suffix
    expect(second.related[0]!.id).toBe("shared-book-2");
    expect(second.primary!.id).toBe("aria-2");
    expect(second.knowledgeRefs).toEqual(["shared-book-2"]);

    const c1 = await store.read("character", first.primary!.id);
    const c2 = await store.read("character", second.primary!.id);
    expect((c1!.body as { knowledgeRefs?: string[] }).knowledgeRefs).toEqual(["shared-book"]);
    expect((c2!.body as { knowledgeRefs?: string[] }).knowledgeRefs).toEqual(["shared-book-2"]);
  });
});
