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
