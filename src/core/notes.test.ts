/**
 * Note operations.
 *
 * The theme is that a failed operation must FAIL, not quietly do something adjacent. An edit against
 * an unknown id that appended instead would turn a mistyped id into a duplicate the author never
 * asked for; a delete that reported success for a note that was not there would stop them looking.
 */
import { describe, expect, test } from "bun:test";
import { addNote, editNote, notesOf, removeNote } from "./notes";

const stamp = (id: string, at = "2026-07-29T00:00:00.000Z", by?: string) => ({ id, at, ...(by ? { by } : {}) });
const piece = () => ({ id: "paramnesia", kind: "preset" as const });

describe("adding", () => {
  test("a note lands with its stamp, oldest first", () => {
    const one = addNote(piece(), "Reset hook must stay first.", stamp("n1"));
    const two = addNote(one, "Second thought.", stamp("n2", "2026-07-29T01:00:00.000Z"));
    expect(notesOf(two).map((n) => n.text)).toEqual(["Reset hook must stay first.", "Second thought."]);
    expect(notesOf(two)[0]).toEqual({ id: "n1", text: "Reset hook must stay first.", at: "2026-07-29T00:00:00.000Z" });
  });

  test("an author is recorded when given, and omitted when not", () => {
    expect(notesOf(addNote(piece(), "x", stamp("n1", undefined, "Chi")))[0]?.by).toBe("Chi");
    expect(notesOf(addNote(piece(), "x", stamp("n1")))[0]).not.toHaveProperty("by");
  });

  test("text is trimmed, and an empty note is refused", () => {
    expect(notesOf(addNote(piece(), "  padded  ", stamp("n1")))[0]?.text).toBe("padded");
    expect(() => addNote(piece(), "   ", stamp("n1"))).toThrow(/needs text/);
  });

  test("the input entity is never mutated", () => {
    const original = piece();
    addNote(original, "x", stamp("n1"));
    expect(original).not.toHaveProperty("notes");
  });

  test("notes ride on the envelope, so the body is untouched", () => {
    // This is what keeps a note out of every adapter's way: no codec has to carry, drop or escrow it.
    const withBody = { ...piece(), body: { name: "Paramnesia" } };
    const annotated = addNote(withBody, "x", stamp("n1"));
    expect(annotated.body).toEqual({ name: "Paramnesia" });
  });
});

describe("editing", () => {
  const one = addNote(piece(), "First", stamp("n1", "2026-07-29T00:00:00.000Z", "Chi"));

  test("the text changes and the timestamp moves; id and author survive", () => {
    const edited = editNote(one, "n1", "Corrected", "2026-07-29T05:00:00.000Z");
    expect(notesOf(edited)[0]).toEqual({
      id: "n1",
      text: "Corrected",
      at: "2026-07-29T05:00:00.000Z",
      by: "Chi",
    });
  });

  test("an unknown id throws instead of appending", () => {
    expect(() => editNote(one, "nope", "x", "2026-07-29T05:00:00.000Z")).toThrow(/no note "nope"/);
    expect(notesOf(one)).toHaveLength(1);
  });

  test("emptying a note by editing is refused", () => {
    expect(() => editNote(one, "n1", "  ", "2026-07-29T05:00:00.000Z")).toThrow(/needs text/);
  });
});

describe("removing", () => {
  test("one note goes and the rest stay in order", () => {
    let p = addNote(piece(), "a", stamp("n1"));
    p = addNote(p, "b", stamp("n2"));
    p = addNote(p, "c", stamp("n3"));
    expect(notesOf(removeNote(p, "n2")).map((n) => n.id)).toEqual(["n1", "n3"]);
  });

  test("removing the last note drops the key entirely", () => {
    // An annotated piece and a never-annotated one must serialize identically, or a round trip
    // shows a difference that is not a difference.
    const p = addNote(piece(), "only", stamp("n1"));
    expect(removeNote(p, "n1")).not.toHaveProperty("notes");
    expect(removeNote(p, "n1")).toEqual(piece());
  });

  test("an unknown id throws rather than reporting a success", () => {
    expect(() => removeNote(piece(), "n1")).toThrow(/no note "n1"/);
  });
});
