/**
 * The rail's keys, as a table you can check.
 *
 * The first two tests are the point of the whole file: they READ the table rather than asserting
 * hand-listed pairs, so a binding added next year that collides with an existing one fails here
 * instead of in somebody's hands. As an if-chain, "does any key mean two things" was a question
 * nobody could answer.
 */
import { describe, expect, test } from "bun:test";
import { footerKeys, keysInGroup, railAction, RAIL_KEYS, type Binding } from "./rail-key-map";

/** The exact chord a binding listens for, as a comparable string. */
const chord = (b: Binding): string =>
  [b.ctrl ? "ctrl" : "", b.shift ? "shift" : "", b.option ? "alt" : "", b.sequence ?? b.name]
    .filter(Boolean).join("+");

describe("one key, one meaning", () => {
  test("NO CHORD IS BOUND TWICE", () => {
    /**
     * The rule the file exists to hold. It was broken four ways at once: r and shift+R renamed
     * different things, Enter opened or applied depending on state, Escape meant three things, and
     * Tab duplicated Enter.
     */
    const seen = new Map<string, string>();
    for (const binding of RAIL_KEYS) {
      const key = chord(binding);
      const already = seen.get(key);
      expect(already === undefined || already === binding.action).toBe(true);
      seen.set(key, binding.action);
    }
  });

  test("no action has a SECOND key unless it is marked an alias", () => {
    /**
     * Two keys for one job is how Tab and Enter both ended up opening a row. Deliberate aliases are
     * fine and sometimes required - Delete and Backspace both delete in every list ever built - but
     * they have to be declared, so the duplicate is a decision rather than something that crept in.
     */
    const byAction = new Map<string, number>();
    for (const binding of RAIL_KEYS) {
      if (binding.alias === true) continue;
      byAction.set(binding.action, (byAction.get(binding.action) ?? 0) + 1);
    }
    for (const [action, count] of byAction) {
      expect(`${action}:${String(count)}`).toBe(`${action}:1`);
    }
  });

  test("an alias reaches the same action as the key it stands in for", () => {
    expect(railAction({ name: "backspace" })).toBe("remove");
    expect(railAction({ name: "delete" })).toBe("remove");
  });

  test("the menu never lists an alias, because one action twice reads as two", () => {
    const listed = [...keysInGroup("block"), ...keysInGroup("preset"), ...keysInGroup("view")];
    expect(listed.every((b) => b.alias !== true)).toBe(true);
  });

  test("every binding says what it does, in words", () => {
    // The menu is generated from these, so an empty one is an invisible feature.
    for (const binding of RAIL_KEYS) {
      expect(binding.says.length).toBeGreaterThan(0);
      expect(binding.label.length).toBeGreaterThan(0);
    }
  });
});

describe("the overloads are gone", () => {
  test("enter opens a row, and never saves", () => {
    // It used to apply every staged change when anything was pending: a look or a write, by state.
    expect(railAction({ name: "return" })).toBe("open-row");
  });

  test("saving has its own key, whatever is pending", () => {
    expect(railAction({ name: "s", sequence: "s" })).toBe("save");
  });

  test("escape closes, and does not throw work away", () => {
    // Dropping staged edits was its third meaning and the only destructive one.
    expect(railAction({ name: "escape" })).toBe("close");
  });

  test("tab moves focus rather than duplicating enter", () => {
    expect(railAction({ name: "tab" })).toBe("focus-next");
  });

  test("ctrl+b is not bound to anything", () => {
    // The chord nothing on screen could teach you, which gated every other key in the rail.
    expect(railAction({ name: "b", ctrl: true })).toBeNull();
  });

  test("the two renames are different letters, not one shift apart", () => {
    expect(railAction({ name: "r", sequence: "r" })).toBe("rename-block");
    expect(railAction({ name: "t", sequence: "t" })).toBe("rename-preset");
    // And shift+R is now nothing at all, rather than quietly the other one.
    expect(railAction({ name: "r", shift: true })).toBeNull();
  });
});

describe("modifiers are exact", () => {
  test("a chord does not fall through to its bare key", () => {
    // ctrl+shift+left resizes; it must not ALSO step to the previous preset.
    expect(railAction({ name: "left", ctrl: true, shift: true })).toBe("narrower");
    expect(railAction({ name: "left" })).toBe("step-prev");
  });

  test("alt+up moves a block, up alone moves the cursor", () => {
    expect(railAction({ name: "up", option: true })).toBe("move-up");
    expect(railAction({ name: "up" })).toBe("cursor-up");
  });

  test("a stray modifier means the key was aimed elsewhere", () => {
    expect(railAction({ name: "return", ctrl: true })).toBeNull();
    expect(railAction({ name: "space", meta: true })).toBeNull();
  });
});

describe("the footer", () => {
  test("holds exactly five", () => {
    // The documented convention, and the number that fits one line at the rail's floor width.
    expect(footerKeys()).toHaveLength(5);
  });

  test("they are the ones somebody needs first", () => {
    expect(footerKeys().map((b) => b.action))
      .toEqual(["open-row", "edit-body", "toggle", "save", "menu"]);
  });
});

describe("the menu", () => {
  test("every non-alias binding lands in exactly one group", () => {
    const total = keysInGroup("block").length + keysInGroup("preset").length + keysInGroup("view").length;
    expect(total).toBe(RAIL_KEYS.filter((b) => b.alias !== true).length);
  });

  test("the two renames are grouped by what they rename", () => {
    // Which is the whole fix: named for their target rather than one shift key apart.
    expect(keysInGroup("block").some((b) => b.action === "rename-block")).toBe(true);
    expect(keysInGroup("preset").some((b) => b.action === "rename-preset")).toBe(true);
  });
});
