/** Verifies compact relative timestamps for saved-session rows. */
import { describe, expect, test } from "bun:test";
import { relativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 6, 23, 12, 0, 0);

describe("relativeTime", () => {
  test("under a minute reads 'just now', including a skewed future stamp", () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe("just now");
    expect(relativeTime(NOW + 5_000, NOW)).toBe("just now");
  });

  test("minutes, hours, and days ago", () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(relativeTime(NOW - 2 * 3_600_000, NOW)).toBe("2h ago");
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe("3d ago");
  });

  test("a week or older reads as a UTC calendar date", () => {
    expect(relativeTime(Date.UTC(2026, 6, 2), NOW)).toBe("Jul 2");
  });
});
