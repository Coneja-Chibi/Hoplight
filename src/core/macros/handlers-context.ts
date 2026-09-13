/**
 * The context-fed handler families: TIME macros reading the caller-supplied clock value, and
 * bucket-2 CHAT macros reading the stub (or someday real) conversation on the context.
 *
 * The clock rule (ADR-012): the engine never asks the machine what time it is. `context.now` is
 * a plain number the CALLER read; absent, every time macro resolves to "" - a preview without a
 * clock says nothing rather than inventing a moment. Locale and time zone default to fixed
 * values ("en-US", "UTC") so an unpinned context still renders deterministically; the UI passes
 * the person's real ones.
 *
 * Chat macros follow the spec's absent-field contract: no messages on the context means the
 * handler's own empty default, never an error - a bare-character caller still gets a render.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "./types";

const ok = (value: string): MacroResult => ({ value, success: true });

const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIMEZONE = "UTC";

const fmt = (context: MacroContext, options: Intl.DateTimeFormatOptions): string => {
  if (context.now === undefined) return "";
  try {
    return new Intl.DateTimeFormat(context.locale ?? DEFAULT_LOCALE, {
      ...options,
      timeZone: context.timezone ?? DEFAULT_TIMEZONE,
    }).format(new Date(context.now));
  } catch {
    // a bad locale/zone string from a context is a value problem, not a render-stopper
    return "";
  }
};

/** YYYY-MM-DD / HH:MM:SS in the context zone, via the locale-proof en-CA/hour24 spellings. */
const isoDate = (context: MacroContext): string =>
  context.now === undefined
    ? ""
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: context.timezone ?? DEFAULT_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(context.now));

const isoTime = (context: MacroContext): string =>
  context.now === undefined
    ? ""
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: context.timezone ?? DEFAULT_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(context.now));

const lastOf = (context: MacroContext, role?: "user" | "assistant"): string => {
  const messages = context.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && (role === undefined ? m.role !== "system" : m.role === role)) return m.content;
  }
  return "";
};

export const CONTEXT_HANDLERS: MacroDefinition[] = [
  // time - volatile (a fresh `now` changes them), clock supplied by the caller
  { name: "time", category: "time", volatile: true, description: "local time, from the caller's clock", handler: (_a, c) => ok(fmt(c, { hour: "numeric", minute: "2-digit" })) },
  { name: "date", category: "time", volatile: true, description: "local date, from the caller's clock", handler: (_a, c) => ok(fmt(c, { year: "numeric", month: "long", day: "numeric" })) },
  { name: "weekday", category: "time", volatile: true, description: "weekday name", handler: (_a, c) => ok(fmt(c, { weekday: "long" })) },
  { name: "isodate", category: "time", volatile: true, description: "YYYY-MM-DD", handler: (_a, c) => ok(isoDate(c)) },
  { name: "isotime", category: "time", volatile: true, description: "HH:MM:SS", handler: (_a, c) => ok(isoTime(c)) },

  // chat - bucket 2: read the stubbed (or real) conversation, empty when absent
  { name: "lastmessage", category: "chat", description: "the newest non-system message", handler: (_a, c) => ok(lastOf(c)) },
  { name: "lastusermessage", category: "chat", description: "the newest user message", handler: (_a, c) => ok(lastOf(c, "user")) },
  { name: "lastcharmessage", category: "chat", description: "the newest assistant message", handler: (_a, c) => ok(lastOf(c, "assistant")) },
  { name: "messagecount", category: "chat", description: "how many messages the chat holds", handler: (_a, c) => ok(String(c.messages?.length ?? 0)) },
  { name: "input", category: "chat", description: "the message being written now", handler: (_a, c) => ok(c.currentMessage ?? "") },
  { name: "chatid", category: "chat", description: "the chat's id", handler: (_a, c) => ok(c.chatId ?? "") },
];
