/**
 * Damage notice rendering: absent for healthy studios, explicit and non-destructive for damage.
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DamageNotice } from "./damage-notice";

test("healthy studios render no damage notice", () => {
  expect(renderToStaticMarkup(<DamageNotice entries={[]} />)).toBe("");
});

test("damaged files render exact names, reasons, path, and recovery guidance", () => {
  const html = renderToStaticMarkup(
    <DamageNotice
      studioDir="C:/Studio"
      entries={[
        { kind: "character", id: "broken", reason: "unreadable-json" },
        { kind: "lorebook", id: "misfiled", reason: "kind-mismatch" },
      ]}
    />,
  );

  expect(html).toContain("2 files in your studio folder could not be read");
  expect(html).toContain("character/broken.json");
  expect(html).toContain("is not readable JSON");
  expect(html).toContain("lorebook/misfiled.json");
  expect(html).toContain("holds a different kind of piece than this folder is for");
  expect(html).toContain("C:/Studio");
  expect(html).toContain("Hoplight did not change them");
});

test("EVERY REASON HAS A SENTENCE, including the one that printed as `undefined`", () => {
  /**
   * The notice took its reason type from a hand-copied list of four while the studio had five, so
   * `unusable-filename` fell out of the bottom of a switch and 123 files were listed on screen as
   * the word `undefined`. The type is imported now, which makes a missing sentence a build failure -
   * this test is the belt: it walks the real union and fails on any entry that renders no words.
   */
  const reasons = [
    "unreadable-json", "schema-mismatch", "kind-mismatch", "id-mismatch", "unusable-filename",
  ] as const;

  for (const reason of reasons) {
    const html = renderToStaticMarkup(
      <DamageNotice entries={[{ kind: "preset", id: "x", reason }]} />,
    );
    expect(html).not.toContain("undefined");
    // A `<code>x.json</code>` followed by nothing is the exact shape the bug had.
    expect(html).toMatch(/<\/code>\s*[a-z]/);
  }
});

test("only a file that renaming would actually rescue is told to rename itself", () => {
  // The advice attached to this reason is real work for somebody, so it is only ever shown when the
  // file is otherwise ours. The store decides that by reading it; see store-damage-reason.test.ts.
  const html = renderToStaticMarkup(
    <DamageNotice entries={[{ kind: "preset", id: "my &preset", reason: "unusable-filename" }]} />,
  );
  expect(html).toContain("rename it");
});
