import { describe, expect, test } from "bun:test";
import { healBook } from "./heal";

describe("healBook", () => {
  test("clean body is stable", () => {
    const { book, healed } = healBook({
      name: "A",
      entries: [
        {
          id: "e1",
          title: "T",
          content: "c",
          enabled: true,
          triggers: [{ keyword: "x", isRegex: false }],
        },
      ],
    });
    expect(book.name).toBe("A");
    expect(book.entries[0]?.title).toBe("T");
    expect(healed.filter((h) => h.path.includes("keys"))).toHaveLength(0);
  });

  test("legacy keys array folds into triggers", () => {
    const { book, healed } = healBook({
      name: "Messy",
      entries: [{ uid: 3, comment: "Old", content: "body", keys: ["alpha", "beta"] }],
    });
    expect(book.entries[0]?.triggers.map((t) => t.keyword)).toEqual(["alpha", "beta"]);
    expect(healed.some((h) => h.message.includes("legacy keys"))).toBe(true);
  });

  test("nested lorebook unwrap", () => {
    const { book, healed } = healBook({
      lorebook: { name: "Nested", entries: [] },
    });
    expect(book.name).toBe("Nested");
    expect(healed.some((h) => h.path === "lorebook")).toBe(true);
  });

  test("non-object yields blank with note", () => {
    const { book, healed } = healBook(null);
    expect(book.entries.length).toBeGreaterThan(0);
    expect(healed.length).toBeGreaterThan(0);
  });

  test("idempotent on result", () => {
    const once = healBook({ name: "X", entries: [{ keys: ["a"], content: "c" }] });
    const twice = healBook(once.book);
    expect(twice.book.name).toBe(once.book.name);
    // Clean re-heal does not invent more triggers
    expect(twice.book.entries[0]?.triggers.map((t) => t.keyword)).toEqual(
      once.book.entries[0]?.triggers.map((t) => t.keyword),
    );
  });
});

/**
 * A string probability of "0" means "never fire on chance" and is a real answer, not a missing one.
 * `Number(x) || 100` read it as "always", inverting the author's intent in the one function whose
 * whole job is honest recovery of messy legacy data.
 */
describe("healBook: coercing a string probability", () => {
  const probOf = (probability: unknown): number | undefined =>
    healBook({ name: "P", entries: [{ id: "e1", content: "c", probability }] }).book.entries[0]?.probability;

  test('"0" stays 0: never is not always', () => {
    expect(probOf("0")).toBe(0);
  });

  test("ordinary values coerce", () => {
    expect(probOf("50")).toBe(50);
    expect(probOf("100")).toBe(100);
  });

  test("out-of-range values clamp, they do not fall back", () => {
    expect(probOf("-20")).toBe(0);
    expect(probOf("250")).toBe(100);
  });

  test("only a non-number falls back to always", () => {
    expect(probOf("banana")).toBe(100);
    expect(probOf("")).toBe(100);
  });

  test("the coercion is reported as healed", () => {
    const { healed } = healBook({ name: "P", entries: [{ id: "e1", content: "c", probability: "0" }] });
    expect(healed.some((h) => h.path === "entries[0].probability")).toBe(true);
  });
});
