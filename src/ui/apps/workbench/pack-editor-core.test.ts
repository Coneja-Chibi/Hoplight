/** Regression: opening and saving a pack must retain named groups and the source escrow envelope. */
import { expect, test } from "bun:test";
import { packEditorDocument } from "./pack-editor-core";

test("pack editor document retains groups and original escrow", () => {
  const doc = packEditorDocument({
    body: {
      name: "Faces",
      pack: { items: [{ id: "n", label: "neutral", ref: "asset://n" }] },
      groups: { side: { items: [{ id: "s", label: "smile", ref: "asset://s" }] } },
    },
    original: { lumiverse: { raw: { sealed: true } } },
  });
  expect(doc.body.groups?.side?.items[0]?.id).toBe("s");
  expect(doc.original).toEqual({ lumiverse: { raw: { sealed: true } } });
});
