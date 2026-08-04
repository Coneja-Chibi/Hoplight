/**
 * Plan usage parsing and display.
 *
 * The risks here are all one shape: reporting a confident number that is not true. A missing field
 * read as zero, a stale figure shown as current, a percentage from the wrong window. Those are what
 * is pinned; the arithmetic is incidental.
 *
 * The fixtures are the real payloads, trimmed. Both were captured from the live services.
 */
import { describe, expect, test } from "bun:test";
import {
  describeWindow,
  formatUsage,
  readClaudeUsage,
  readCodexUsage,
  refuseUsage,
  untilReset,
  type UsageOutcome,
} from "./plan-usage";

const NOW = Date.UTC(2026, 7, 1, 21, 0, 0);

const CLAUDE_BODY = {
  five_hour: { utilization: 6.0, resets_at: "2026-08-01T23:40:00.165541+00:00" },
  seven_day: { utilization: 65.0, resets_at: "2026-08-01T23:00:00.165565+00:00" },
  // Every plan gets the full menu of slots; the ones it does not use come back null.
  seven_day_opus: null,
  seven_day_sonnet: null,
  extra_usage: { is_enabled: false, monthly_limit: 20000, used_credits: 0.0, currency: "CAD" },
};

const codexHeaders = (extra: Record<string, string> = {}): Headers =>
  new Headers({
    "x-codex-plan-type": "pro",
    "x-codex-primary-used-percent": "6",
    "x-codex-primary-window-minutes": "10080",
    "x-codex-primary-reset-at": "1786159982",
    "x-codex-secondary-used-percent": "0",
    "x-codex-secondary-window-minutes": "0",
    "x-codex-credits-balance": "0",
    "x-codex-credits-has-credits": "False",
    ...extra,
  });

describe("readClaudeUsage", () => {
  test("reads the windows a plan actually has, and skips the slots it does not", () => {
    const usage = readClaudeUsage(CLAUDE_BODY, NOW, "max")!;
    expect(usage.windows.map((w) => w.label)).toEqual(["5-hour", "7-day"]);
    expect(usage.windows[0]!.percentUsed).toBe(6);
    expect(usage.windows[1]!.percentUsed).toBe(65);
    expect(usage.plan).toBe("max");
    expect(usage.source).toBe("endpoint");
  });

  test("an ISO reset becomes epoch ms", () => {
    const usage = readClaudeUsage(CLAUDE_BODY, NOW, "max")!;
    expect(usage.windows[0]!.resetsAt).toBe(Date.parse("2026-08-01T23:40:00.165541+00:00"));
  });

  test("a body with no readable window is null, never an empty success", () => {
    // "The service said nothing" and "you have used nothing" must never collapse together.
    for (const body of [null, {}, "no", { five_hour: null, seven_day: null }, { five_hour: {} }]) {
      expect(readClaudeUsage(body, NOW)).toBeNull();
    }
  });

  test("extra usage is carried with its currency, since the number is meaningless without it", () => {
    const usage = readClaudeUsage(CLAUDE_BODY, NOW)!;
    expect(usage.overage).toEqual({ enabled: false, used: 0, limit: 20000, currency: "CAD" });
  });
});

describe("readCodexUsage", () => {
  test("reads the primary window and names its real length", () => {
    const usage = readCodexUsage(codexHeaders(), NOW)!;
    expect(usage.plan).toBe("pro");
    expect(usage.source).toBe("response-headers");
    expect(usage.windows).toHaveLength(1);
    expect(usage.windows[0]!.label).toBe("primary (7d)");
    expect(usage.windows[0]!.percentUsed).toBe(6);
  });

  test("a zero-minute window is not in force and is left out", () => {
    // Reporting "secondary 0%" would read as headroom on a limit that does not exist.
    const usage = readCodexUsage(codexHeaders(), NOW)!;
    expect(usage.windows.some((w) => w.label.startsWith("secondary"))).toBe(false);
  });

  test("a second window is reported once the service enforces one", () => {
    const usage = readCodexUsage(
      codexHeaders({ "x-codex-secondary-window-minutes": "300", "x-codex-secondary-used-percent": "12" }),
      NOW,
    )!;
    expect(usage.windows.map((w) => w.label)).toEqual(["primary (7d)", "secondary (5h)"]);
    expect(usage.windows[1]!.percentUsed).toBe(12);
  });

  test("epoch-seconds resets become ms", () => {
    const usage = readCodexUsage(codexHeaders(), NOW)!;
    expect(usage.windows[0]!.resetsAt).toBe(1786159982 * 1000);
  });

  test("Python-spelled booleans are read as booleans", () => {
    // The service sends "True"/"False", not JSON true/false; a naive read makes "False" truthy.
    expect(readCodexUsage(codexHeaders(), NOW)!.overage!.enabled).toBe(false);
    expect(
      readCodexUsage(codexHeaders({ "x-codex-credits-has-credits": "True" }), NOW)!.overage!.enabled,
    ).toBe(true);
  });

  test("headers without any quota fields are null, not a zeroed plan", () => {
    expect(readCodexUsage(new Headers({ "content-type": "application/json" }), NOW)).toBeNull();
  });
});

describe("describeWindow", () => {
  test("names the window the way a person would", () => {
    expect(describeWindow(10080)).toBe("7d");
    expect(describeWindow(300)).toBe("5h");
    expect(describeWindow(45)).toBe("45m");
  });
});

describe("untilReset", () => {
  test("counts down, and says now once it has passed", () => {
    expect(untilReset(NOW + 90 * 60_000, NOW)).toBe("in 1h 30m");
    expect(untilReset(NOW + 30 * 60_000, NOW)).toBe("in 30m");
    expect(untilReset(NOW + 2 * 86_400_000, NOW)).toBe("in 2d 0h");
    expect(untilReset(NOW - 1, NOW)).toBe("now");
  });
});

describe("formatUsage", () => {
  const claude: UsageOutcome = { ok: true, ...readClaudeUsage(CLAUDE_BODY, NOW, "max")! };

  test("says how old a header-sourced figure is, and does not say it of a fetched one", () => {
    // The whole reason `source` and `observedAt` are on the record: a figure read off a turn an hour
    // ago must not sit beside a fresh one looking equally current.
    const stale: UsageOutcome = { ok: true, ...readCodexUsage(codexHeaders(), NOW - 3_600_000)! };
    const text = formatUsage([claude, stale], NOW);
    expect(text).toContain("asked just now");
    expect(text).toContain("60m ago");
  });

  test("a provider that could not be read is shown, not quietly dropped", () => {
    const text = formatUsage([refuseUsage("claude", "no-credentials", "run `claude login`.")], NOW);
    expect(text).toContain("claude");
    expect(text).toContain("run `claude login`.");
  });

  test("no connected provider says so, rather than showing an empty plan", () => {
    expect(formatUsage([], NOW)).toContain("No subscription provider is connected");
  });

  test("points at /privacy as the separate, stronger claim", () => {
    expect(formatUsage([claude], NOW)).toContain("/privacy");
  });
});
