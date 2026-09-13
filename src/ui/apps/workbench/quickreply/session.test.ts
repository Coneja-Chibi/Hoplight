/** Regression coverage for quick-reply set editing without executing message payloads. */
import { expect, test } from "bun:test";
import { addReply, patchReply, quickReplyDirty, removeReply } from "./session";

const body = { name: "Commands", replies: [{ id: "one", label: "Go", message: "/send go" }] };

test("quick-reply editing changes only the selected row", () => {
  const added = addReply(body);
  expect(added.replies).toHaveLength(2);
  const edited = patchReply(added, "one", { label: "Begin", hidden: true });
  expect(edited.replies[0]).toMatchObject({ label: "Begin", message: "/send go", hidden: true });
  expect(body.replies[0]!.label).toBe("Go");
});

test("remove and dirty state are structural", () => {
  expect(removeReply(body, "one").replies).toEqual([]);
  expect(quickReplyDirty(structuredClone(body), body)).toBe(false);
  expect(quickReplyDirty({ ...body, name: "Other" }, body)).toBe(true);
});
