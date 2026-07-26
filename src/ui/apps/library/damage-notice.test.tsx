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
  expect(html).toContain("contains a different content type");
  expect(html).toContain("C:/Studio");
  expect(html).toContain("Hoplight did not change them");
});
