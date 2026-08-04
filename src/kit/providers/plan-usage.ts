/**
 * What a turn has cost against a subscription plan, from the two services that will say.
 *
 * A DIFFERENT QUESTION FROM THE EGRESS LEDGER, and the two must not merge. The ledger answers "what
 * left this machine": Kit's own record of its own sends, which is why it can be trusted absolutely.
 * This answers "how much of my plan is gone", which only the provider knows, and which Kit can
 * therefore only ever REPORT rather than vouch for. Keeping them separate keeps the ledger's promise
 * exact.
 *
 * The two providers answer very differently and this module does not pretend otherwise:
 *
 *   Anthropic serves a dedicated endpoint, so the number is fresh and costs a request.
 *   OpenAI's Codex endpoint returns the whole picture in response headers on EVERY call, so the
 *   number is free and is exactly as old as the last turn.
 *
 * That is why `observedAt` and `source` are on the record rather than implied. Showing a figure read
 * off a turn from an hour ago next to one fetched a second ago, with nothing to tell them apart,
 * would be the same quiet dishonesty as a ledger that under-reports.
 *
 * This module is PURE: shapes, parsing and formatting only. The credential reading and the network
 * live in plan-usage-sources.ts, so the parsing can be tested exhaustively without either.
 */

/** One limit window a plan enforces, normalised across the two services' very different spellings. */
export interface QuotaWindow {
  /** How the provider names this window, for display: "5-hour", "7-day", "primary (7d)". */
  readonly label: string;
  /** Share of the window consumed, 0-100. */
  readonly percentUsed: number;
  /** When it resets, epoch ms. Absent when the provider did not say. */
  readonly resetsAt?: number;
}

/** Paid usage beyond the plan, when the provider exposes it. */
export interface OverageState {
  readonly enabled: boolean;
  readonly used?: number;
  readonly limit?: number;
  readonly currency?: string;
}

export interface PlanUsage {
  readonly provider: string;
  /** The plan's own name for itself, e.g. "max", "pro". Absent when not reported. */
  readonly plan?: string;
  readonly windows: readonly QuotaWindow[];
  readonly overage?: OverageState;
  /** When this was true, epoch ms. Load-bearing: a header figure is as old as the last turn. */
  readonly observedAt: number;
  /** Where it came from, so a reader can judge its age without knowing the implementation. */
  readonly source: "endpoint" | "response-headers";
}

/** Why a plan could not be read. A value, never a throw: "not connected" and "0% used" are opposites. */
export type UsageFailure = "no-credentials" | "not-supported" | "unreachable" | "unreadable";

export interface UsageRefusal {
  readonly ok: false;
  readonly provider: string;
  readonly reason: UsageFailure;
  /** One sentence, already phrased for a reader, naming what to do where there is something to do. */
  readonly detail: string;
}

export type UsageOutcome = ({ readonly ok: true } & PlanUsage) | UsageRefusal;

export const refuseUsage = (provider: string, reason: UsageFailure, detail: string): UsageRefusal =>
  ({ ok: false, provider, reason, detail });

// ---- parsing ------------------------------------------------------------------------------------

/** A finite percentage, clamped to 0-100. A provider reporting 103 is a display bug, not a crisis. */
const percent = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
};

/** Epoch ms from either an ISO string (Anthropic) or epoch seconds (OpenAI). */
const instant = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Seconds, not milliseconds: every plausible reset is far below this bound as ms.
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === "string" && value !== "") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return instant(asNumber);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const window = (label: string, used: unknown, resets: unknown): QuotaWindow | null => {
  const pct = percent(used);
  if (pct === null) return null;
  const at = instant(resets);
  return at === undefined ? { label, percentUsed: pct } : { label, percentUsed: pct, resetsAt: at };
};

/**
 * Anthropic's `/api/oauth/usage` body.
 *
 * It carries many more window slots than any one plan uses (per-model weeklies and a set of
 * codenamed ones), all null on a plan that does not have them. Only the ones actually populated are
 * reported, so a reader sees their plan rather than the service's full menu.
 */
export function readClaudeUsage(body: unknown, observedAt: number, plan?: string): PlanUsage | null {
  if (body === null || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  const named: Array<[string, string]> = [
    ["five_hour", "5-hour"],
    ["seven_day", "7-day"],
    ["seven_day_opus", "7-day (Opus)"],
    ["seven_day_sonnet", "7-day (Sonnet)"],
  ];
  const windows: QuotaWindow[] = [];
  for (const [key, label] of named) {
    const slot = record[key];
    if (slot === null || typeof slot !== "object") continue;
    const s = slot as Record<string, unknown>;
    const w = window(label, s["utilization"], s["resets_at"]);
    if (w) windows.push(w);
  }
  if (windows.length === 0) return null;

  let overage: OverageState | undefined;
  const extra = record["extra_usage"];
  if (extra !== null && typeof extra === "object") {
    const e = extra as Record<string, unknown>;
    overage = {
      enabled: e["is_enabled"] === true,
      used: typeof e["used_credits"] === "number" ? e["used_credits"] : undefined,
      limit: typeof e["monthly_limit"] === "number" ? e["monthly_limit"] : undefined,
      currency: typeof e["currency"] === "string" ? e["currency"] : undefined,
    };
  }

  return { provider: "claude", plan, windows, overage, observedAt, source: "endpoint" };
}

/**
 * Codex's quota, read off the `x-codex-*` headers any response carries.
 *
 * The window lengths arrive as minutes rather than names, so the label is derived from the number
 * and says what the service actually enforces instead of assuming a 5-hour/7-day shape that is
 * Anthropic's, not OpenAI's. A window reported as zero minutes is not in force and is skipped.
 */
export function readCodexUsage(headers: Headers | Map<string, string>, observedAt: number): PlanUsage | null {
  const get = (name: string): string | undefined => {
    const value = headers instanceof Map ? headers.get(name) : headers.get(name);
    return value ?? undefined;
  };

  const windows: QuotaWindow[] = [];
  for (const kind of ["primary", "secondary"] as const) {
    const minutes = Number(get(`x-codex-${kind}-window-minutes`));
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    const w = window(
      `${kind} (${describeWindow(minutes)})`,
      get(`x-codex-${kind}-used-percent`),
      get(`x-codex-${kind}-reset-at`),
    );
    if (w) windows.push(w);
  }
  if (windows.length === 0) return null;

  const balance = Number(get("x-codex-credits-balance"));
  const overage: OverageState = {
    // The service spells these as Python booleans ("True"/"False"), not JSON.
    enabled: (get("x-codex-credits-has-credits") ?? "").toLowerCase() === "true",
    used: Number.isFinite(balance) ? balance : undefined,
  };

  return {
    provider: "codex",
    plan: get("x-codex-plan-type"),
    windows,
    overage,
    observedAt,
    source: "response-headers",
  };
}

/** "7d", "5h", "45m" from a count of minutes. */
export function describeWindow(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.round(minutes)}m`;
}

// ---- display ------------------------------------------------------------------------------------

/** "in 6h 20m", or "now" once it has passed. */
export function untilReset(resetsAt: number, now: number): string {
  const seconds = Math.round((resetsAt - now) / 1000);
  if (seconds <= 0) return "now";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

/** A ten-cell bar. Plain text, because the transcript renders markdown and this must not wrap oddly. */
const bar = (percentUsed: number): string => {
  const filled = Math.round((percentUsed / 100) * 10);
  return `${"#".repeat(filled)}${".".repeat(10 - filled)}`;
};

/** How stale a figure is, said plainly. Only meaningful for the header-sourced provider. */
const observedNote = (usage: PlanUsage, now: number): string => {
  if (usage.source === "endpoint") return "asked just now";
  const age = Math.max(0, Math.round((now - usage.observedAt) / 60_000));
  if (age === 0) return "from your last turn";
  return `from your last turn, ${age}m ago`;
};

/**
 * The `/usage` readout. Markdown, so the transcript renders it like any other reply.
 *
 * Refusals are printed beside successes rather than dropped: a provider that could not be read is
 * information, and silently omitting it would let a reader believe they had seen everything.
 */
export function formatUsage(outcomes: readonly UsageOutcome[], now: number): string {
  if (outcomes.length === 0) {
    return "**Plan usage**\n\nNo subscription provider is connected. `/usage` reads the plan behind a "
      + "Claude or ChatGPT login; an API key has no plan to report.";
  }
  const lines: string[] = ["**Plan usage**", ""];
  for (const outcome of outcomes) {
    if (!outcome.ok) {
      lines.push(`- **${outcome.provider}**: ${outcome.detail}`);
      continue;
    }
    const head = outcome.plan ? `**${outcome.provider}** (${outcome.plan})` : `**${outcome.provider}**`;
    lines.push(`- ${head} · ${observedNote(outcome, now)}`);
    for (const w of outcome.windows) {
      const reset = w.resetsAt === undefined ? "" : ` · resets ${untilReset(w.resetsAt, now)}`;
      lines.push(`    \`${bar(w.percentUsed)}\` ${Math.round(w.percentUsed)}% ${w.label}${reset}`);
    }
    if (outcome.overage?.enabled) {
      const amount = outcome.overage.used ?? 0;
      const cap = outcome.overage.limit;
      const currency = outcome.overage.currency ? ` ${outcome.overage.currency}` : "";
      lines.push(`    extra usage on: ${amount}${cap ? ` of ${cap}` : ""}${currency}`);
    }
  }
  lines.push("");
  lines.push("These figures come from the provider, not from Kit. `/privacy` is Kit's own record of what it sent.");
  return lines.join("\n");
}
