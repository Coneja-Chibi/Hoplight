/**
 * The prompt list's counts / tabs / search, ported from RC's PromptListV4.
 */
import { describe, expect, test } from "bun:test";
import {
  filterByTab,
  groupSections,
  promptCounts,
  promptMatchesSearch,
  PROMPT_FILTER_TABS,
  visiblePrompts,
} from "./list-view";
import type { PresetGroup, PresetPrompt } from "../../entities/preset";

const block = (over: Partial<PresetPrompt>): PresetPrompt => ({
  id: over.id ?? "x",
  name: over.name ?? "Block",
  role: "system",
  content: "",
  enabled: true,
  placement: "relative",
  injectionOrder: 100,
  injectionDepth: 0,
  systemPrompt: false,
  forbidOverrides: false,
  marker: false,
  ...over,
});

const LIST: PresetPrompt[] = [
  block({ id: "a", name: "Jailbreak", placement: "relative", content: "rules here" }),
  block({ id: "b", name: "Nudge", placement: "in_chat", content: "stay in character" }),
  block({ id: "c", name: "Glue", placement: "append", content: "tail text" }),
  block({ id: "d", name: "Off block", placement: "relative", enabled: false, content: "" }),
  block({ id: "e", name: "Bottom", placement: "append_preset", content: "" }),
];

describe("promptCounts", () => {
  test("counts over every block, not the filtered view", () => {
    expect(promptCounts(LIST)).toEqual({ total: 5, relative: 2, inchat: 2, enabled: 4 });
  });
  test("empty list", () => {
    expect(promptCounts([])).toEqual({ total: 0, relative: 0, inchat: 0, enabled: 0 });
  });
});

describe("filterByTab", () => {
  test("all keeps everything", () => {
    expect(filterByTab(LIST, "all").map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
  test("relative is placement=relative only", () => {
    expect(filterByTab(LIST, "relative").map((p) => p.id)).toEqual(["a", "d"]);
  });
  test("inchat covers the at-depth stops (in_chat + append)", () => {
    expect(filterByTab(LIST, "inchat").map((p) => p.id)).toEqual(["b", "c"]);
  });
  test("append_preset is neither relative nor in-chat", () => {
    for (const tab of ["relative", "inchat"] as const) {
      expect(filterByTab(LIST, tab).map((p) => p.id)).not.toContain("e");
    }
  });
  test("never mutates the input", () => {
    const before = LIST.map((p) => p.id);
    filterByTab(LIST, "relative");
    expect(LIST.map((p) => p.id)).toEqual(before);
  });
});

describe("promptMatchesSearch", () => {
  test("matches name or content, case-insensitively", () => {
    expect(promptMatchesSearch(LIST[0]!, "JAIL")).toBe(true);
    expect(promptMatchesSearch(LIST[0]!, "rules")).toBe(true);
    expect(promptMatchesSearch(LIST[0]!, "nope")).toBe(false);
  });
  test("blank query matches everything", () => {
    for (const p of LIST) expect(promptMatchesSearch(p, "   ")).toBe(true);
  });
});

describe("groupSections", () => {
  const groups: PresetGroup[] = [
    { id: "g2", name: "Second", order: 2 },
    { id: "g1", name: "First", order: 1 },
  ];
  const list: PresetPrompt[] = [
    block({ id: "loose" }),
    block({ id: "in1", groupId: "g1" }),
    block({ id: "in2", groupId: "g2" }),
    block({ id: "in1b", groupId: "g1" }),
  ];

  test("uncategorized run comes first, then groups by order", () => {
    const s = groupSections(list, groups);
    expect(s.map((x) => x.group?.name ?? null)).toEqual([null, "First", "Second"]);
    expect(s[1]!.prompts.map((p) => p.id)).toEqual(["in1", "in1b"]);
  });

  test("a block naming a group that does not exist is kept as uncategorized, never dropped", () => {
    const s = groupSections([block({ id: "orphan", groupId: "ghost" })], groups);
    expect(s[0]!.prompts.map((p) => p.id)).toEqual(["orphan"]);
    const total = s.reduce((n, x) => n + x.prompts.length, 0);
    expect(total).toBe(1);
  });

  test("empty groups survive so you can still drop into them", () => {
    const s = groupSections([block({ id: "loose" })], groups);
    expect(s.map((x) => x.group?.id ?? null)).toEqual([null, "g1", "g2"]);
    expect(s[1]!.prompts).toEqual([]);
  });

  test("never loses or duplicates a block", () => {
    const s = groupSections(list, groups);
    const ids = s.flatMap((x) => x.prompts.map((p) => p.id)).sort();
    expect(ids).toEqual(["in1", "in1b", "in2", "loose"]);
  });

  test("no groups: one uncategorized section holding everything", () => {
    const s = groupSections(list, []);
    expect(s.length).toBe(1);
    expect(s[0]!.prompts.length).toBe(4);
  });
});

describe("visiblePrompts", () => {
  test("applies the tab, then the search", () => {
    expect(visiblePrompts(LIST, "inchat", "character").map((p) => p.id)).toEqual(["b"]);
  });
  test("search alone spans tabs", () => {
    expect(visiblePrompts(LIST, "all", "e").map((p) => p.id).length).toBeGreaterThan(1);
  });
  test("no matches yields empty, never everything", () => {
    expect(visiblePrompts(LIST, "all", "zzzz")).toEqual([]);
  });
  test("every tab is exhaustive over the union", () => {
    const seen = new Set(PROMPT_FILTER_TABS.flatMap((t) => filterByTab(LIST, t).map((p) => p.id)));
    expect(seen.size).toBe(LIST.length);
  });
});
