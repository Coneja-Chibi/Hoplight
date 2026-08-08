/**
 * Telling a second click from a new one.
 *
 * The whole value is at the boundaries: too eager and two separate clicks on the same row take over
 * the screen with an editor nobody asked for; too strict and a deliberate double-click on a slow hand
 * is just two selections.
 */
import { describe, expect, test } from "bun:test";
import { DOUBLE_CLICK_MS, noClicks, registerClick } from "./double-click";

describe("registerClick", () => {
  test("the first click is never a double", () => {
    expect(registerClick(noClicks(), "a", 1000).double).toBe(false);
  });

  test("a second click on the same row, soon enough, is", () => {
    const first = registerClick(noClicks(), "a", 1000);
    expect(registerClick(first.memory, "a", 1200).double).toBe(true);
  });

  test("exactly at the threshold still counts", () => {
    // Inclusive on purpose: landing precisely on the boundary should not be a coin toss.
    const first = registerClick(noClicks(), "a", 1000);
    expect(registerClick(first.memory, "a", 1000 + DOUBLE_CLICK_MS).double).toBe(true);
  });

  test("one millisecond past it does not", () => {
    const first = registerClick(noClicks(), "a", 1000);
    expect(registerClick(first.memory, "a", 1001 + DOUBLE_CLICK_MS).double).toBe(false);
  });

  test("THE ROW HAS TO MATCH", () => {
    /**
     * Two fast clicks on two different blocks are two selections. On twenty-three rows in a narrow
     * rail, clicking two neighbours quickly is ordinary, and opening an editor for it would be
     * hostile.
     */
    const first = registerClick(noClicks(), "a", 1000);
    expect(registerClick(first.memory, "b", 1050).double).toBe(false);
  });

  test("a near-miss still arms the next click", () => {
    // The one that got away becomes the first of the next pair, rather than being thrown out.
    const first = registerClick(noClicks(), "a", 1000);
    const slow = registerClick(first.memory, "a", 2000);
    expect(slow.double).toBe(false);
    expect(registerClick(slow.memory, "a", 2100).double).toBe(true);
  });

  test("A DOUBLE RESETS, so three clicks are not two doubles", () => {
    // Otherwise a third fast click opens the editor a second time, and a fourth a third.
    const a = registerClick(noClicks(), "a", 1000);
    const b = registerClick(a.memory, "a", 1100);
    expect(b.double).toBe(true);
    expect(registerClick(b.memory, "a", 1200).double).toBe(false);
  });

  test("switching rows arms the new one", () => {
    const first = registerClick(noClicks(), "a", 1000);
    const other = registerClick(first.memory, "b", 1050);
    expect(registerClick(other.memory, "b", 1100).double).toBe(true);
  });

  test("a clock that went backwards is not a double", () => {
    // Never negative-time into an open: a resumed process or a corrected clock should do nothing.
    const first = registerClick(noClicks(), "a", 5000);
    expect(registerClick(first.memory, "a", 4000).double).toBe(false);
  });
});
