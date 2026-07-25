/** Notification planning tests for focus gating and settled-turn events. */
import { describe, expect, test } from "bun:test";
import { planNotifications, type NotifySettings, type SettleEvent } from "./plan";

const ALL_ON: NotifySettings = { title: true, bell: true, desktop: true };
const settle = (over: Partial<SettleEvent>): SettleEvent => ({ summary: "Half-Moon Studio", focused: null, ...over });

describe("planNotifications focus gating", () => {
  test("focused: title only (bell + desktop suppressed while watching)", () => {
    expect(planNotifications(settle({ focused: true }), ALL_ON)).toEqual([
      { channel: "title", text: "done · Half-Moon Studio" },
    ]);
  });

  test("unfocused: short title + bell + desktop", () => {
    expect(planNotifications(settle({ focused: false }), ALL_ON)).toEqual([
      { channel: "title", text: "done" },
      { channel: "bell" },
      { channel: "desktop", body: "Kit finished · Half-Moon Studio" },
    ]);
  });

  test("unknown focus: title + bell, but NO desktop (never nudge on a guess)", () => {
    expect(planNotifications(settle({ focused: null }), ALL_ON)).toEqual([
      { channel: "title", text: "done · Half-Moon Studio" },
      { channel: "bell" },
    ]);
  });
});

describe("planNotifications settings toggles", () => {
  test("title off suppresses the title action even when the others fire", () => {
    expect(planNotifications(settle({ focused: false }), { title: false, bell: true, desktop: true })).toEqual([
      { channel: "bell" },
      { channel: "desktop", body: "Kit finished · Half-Moon Studio" },
    ]);
  });

  test("everything off yields no actions", () => {
    expect(planNotifications(settle({ focused: false }), { title: false, bell: false, desktop: false })).toEqual([]);
  });
});

describe("planNotifications safe default", () => {
  test("a blank summary degrades to 'done' and a plain desktop body", () => {
    expect(planNotifications({ summary: "   ", focused: false }, ALL_ON)).toEqual([
      { channel: "title", text: "done" },
      { channel: "bell" },
      { channel: "desktop", body: "Kit finished" },
    ]);
  });

  test("a blank summary while focused still yields a 'done' title", () => {
    expect(planNotifications({ summary: "", focused: true }, ALL_ON)).toEqual([
      { channel: "title", text: "done" },
    ]);
  });
});
