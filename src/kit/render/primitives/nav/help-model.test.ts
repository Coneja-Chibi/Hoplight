/** Help navigation model tests for grouping, filtering, and keyboard reduction. */
import { describe, expect, test } from "bun:test";
import { buildHelp, initHelp, reduce, type HelpCommand } from "./help-model";
import type { Keybinding } from "./keymap";

const cmd = (name: string, summary: string, group?: string, aliases?: string[]): HelpCommand => ({
  name,
  summary,
  ...(group ? { group } : {}),
  ...(aliases ? { aliases } : {}),
});

const KEYMAP: readonly Keybinding[] = [
  { keys: "ctrl+f", label: "search the transcript", group: "moving" },
  { keys: "ctrl+o", label: "fold the latest trace", group: "session" },
];

const titles = (model: ReturnType<typeof buildHelp>): string[] => model.sections.map((s) => s.title);

describe("buildHelp grouping", () => {
  test("buckets commands into ordered sections: setup, moving, session", () => {
    const model = buildHelp(
      [
        cmd("/quit", "leave Kit", "session"),
        cmd("/model", "connect a brain", "setup"),
        cmd("/help", "this stage", "moving", ["/?"]),
      ],
      [],
    );
    expect(titles(model)).toEqual(["SETUP", "MOVING AROUND", "SESSION"]);
    expect(model.sections[0]!.rows[0]).toEqual({ keys: "/model", note: "connect a brain" });
  });

  test("an absent group falls to the Other bucket, ordered last, never dropped", () => {
    const model = buildHelp([cmd("/setup", "s", "setup"), cmd("/mystery", "no group")], []);
    expect(titles(model)).toEqual(["SETUP", "OTHER"]);
    const other = model.sections.at(-1)!;
    expect(other.rows).toEqual([{ keys: "/mystery", note: "no group" }]);
  });

  test("an unknown named group sorts in after the known ones, before Other", () => {
    const model = buildHelp(
      [cmd("/z", "z", "zebra"), cmd("/m", "m", "moving"), cmd("/o", "o")],
      [],
    );
    expect(titles(model)).toEqual(["MOVING AROUND", "ZEBRA", "OTHER"]);
  });

  test("commands render before keybindings within a section", () => {
    const model = buildHelp([cmd("/help", "this stage", "moving", ["/?"])], KEYMAP);
    const moving = model.sections.find((s) => s.title === "MOVING AROUND")!;
    expect(moving.rows).toEqual([
      { keys: "/help  (/?)", note: "this stage" },
      { keys: "ctrl+f", note: "search the transcript" },
    ]);
  });
});

describe("buildHelp keybinding section always renders", () => {
  test("an empty command list still yields the keybinding-bearing sections, never blank", () => {
    const model = buildHelp([], KEYMAP);
    expect(model.sections.length).toBeGreaterThan(0);
    const moving = model.sections.find((s) => s.title === "MOVING AROUND")!;
    expect(moving.rows).toContainEqual({ keys: "ctrl+f", note: "search the transcript" });
  });

  test("no commands and no bindings yields an empty (but valid) model, never throws", () => {
    expect(() => buildHelp([], [])).not.toThrow();
    expect(buildHelp([], []).sections).toEqual([]);
  });
});

describe("reduce is total", () => {
  test("esc and q close, even after scrolling", () => {
    const scrolled = reduce(reduce(initHelp(), { name: "down" }), { name: "down" });
    expect(reduce(scrolled, { name: "escape" }).open).toBe(false);
    expect(reduce(scrolled, { name: "q" }).open).toBe(false);
  });

  test("up clamps at the top; down and paging advance the scroll", () => {
    expect(reduce(initHelp(), { name: "up" }).scroll).toBe(0);
    expect(reduce(initHelp(), { name: "down" }).scroll).toBe(1);
    expect(reduce(initHelp(), { name: "pagedown" }).scroll).toBeGreaterThan(1);
    expect(reduce(reduce(initHelp(), { name: "pagedown" }), { name: "pageup" }).scroll).toBe(0);
  });

  test("an unhandled key returns the same state reference", () => {
    const state = initHelp();
    expect(reduce(state, { name: "tab" })).toBe(state);
  });
});
