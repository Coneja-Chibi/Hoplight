import { describe, expect, test } from "bun:test";
import { emptyLoreEntry } from "../../../../core/lore";
import { firesLine, timingLine } from "./entry-fire-mode";

const base = () => emptyLoreEntry("e1");

describe("timingLine", () => {
  test("default entry: every time, no dials", () => {
    expect(timingLine(base())).toContain("Fires every time");
    expect(timingLine(base())).toContain("No chance roll");
  });

  test("reflects chance, sticky, cooldown, delay", () => {
    const e = {
      ...base(),
      probability: 40,
      sticky: 2,
      cooldown: 3,
      delay: 1,
    };
    const line = timingLine(e);
    expect(line).toContain("40% chance");
    expect(line).toContain("sticks for 2 messages");
    expect(line).toContain("cooldown 3 messages");
    expect(line).toContain("waits 1 message first");
  });

  test("0% chance called out", () => {
    expect(timingLine({ ...base(), probability: 0 })).toContain("0% chance");
  });

  test("recursion and group", () => {
    const line = timingLine({
      ...base(),
      preventRecursion: true,
      groupName: "places",
    });
    expect(line).toContain("never wakes others");
    expect(line).toContain('group "places"');
  });

  test("updates when fields change (live summary contract)", () => {
    const a = { ...base(), sticky: 0 };
    const b = { ...base(), sticky: 5 };
    expect(timingLine(a)).not.toEqual(timingLine(b));
    expect(timingLine(b)).toContain("sticks for 5");
  });
});

describe("firesLine", () => {
  test("keys and constant", () => {
    expect(firesLine({ ...base(), constant: true })).toContain("Always on");
    expect(
      firesLine({
        ...base(),
        triggers: [{ keyword: "powers", isRegex: false }],
      }),
    ).toContain("powers");
  });
});
