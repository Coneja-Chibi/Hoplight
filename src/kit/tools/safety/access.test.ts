/** Tool-access resolution tests for known operations and fail-closed defaults. */
import { describe, expect, test } from "bun:test";
import { createAccessResolver, resolveAccess } from "./access";

describe("resolveAccess", () => {
  test("the known read tools resolve to read", () => {
    expect(resolveAccess("studio_list")).toBe("read");
    expect(resolveAccess("studio_read")).toBe("read");
    expect(resolveAccess("studio_search")).toBe("read");
    expect(resolveAccess("docs_query")).toBe("read");
    expect(resolveAccess("capability_find")).toBe("read");
    expect(resolveAccess("result_query")).toBe("read");
    expect(resolveAccess("change_query")).toBe("read");
  });

  test("draft lifecycle tools have explicit least-privilege classes", () => {
    expect(resolveAccess("change_discard")).toBe("draft");
    expect(resolveAccess("change_apply")).toBe("write");
    expect(resolveAccess("studio_character_create")).toBe("draft");
    expect(resolveAccess("studio_lorebook_create")).toBe("draft");
    expect(resolveAccess("studio_persona_create")).toBe("draft");
    expect(resolveAccess("studio_preset_create")).toBe("draft");
    expect(resolveAccess("studio_regex_create")).toBe("draft");
    expect(resolveAccess("studio_pack_create")).toBe("draft");
    expect(resolveAccess("studio_quickreply_create")).toBe("draft");
  });

  test("only catalog-supplied capability names become safe drafts", () => {
    const resolve = createAccessResolver(["lorebook_entries_update"]);
    expect(resolve("lorebook_entries_update")).toBe("draft");
    expect(resolve("lorebook_entries_remove")).toBe("unknown");
    expect(resolve("lorebook_entries_update_extra")).toBe("unknown");
  });

  test("catalog-supplied read capabilities remain read-only", () => {
    const resolve = createAccessResolver([
      { name: "lorebook_health_inspect", access: "read" },
    ]);
    expect(resolve("lorebook_health_inspect")).toBe("read");
  });

  test("an absent tool resolves to unknown (deny by absence)", () => {
    expect(resolveAccess("delete")).toBe("unknown");
    expect(resolveAccess("write")).toBe("unknown");
    expect(resolveAccess("")).toBe("unknown");
  });

  test("a prototype-chain key never surfaces a phantom access", () => {
    expect(resolveAccess("__proto__")).toBe("unknown");
    expect(resolveAccess("toString")).toBe("unknown");
    expect(resolveAccess("hasOwnProperty")).toBe("unknown");
  });

  test("a non-string name resolves to unknown", () => {
    expect(resolveAccess(undefined as unknown as string)).toBe("unknown");
    expect(resolveAccess(123 as unknown as string)).toBe("unknown");
  });
});
