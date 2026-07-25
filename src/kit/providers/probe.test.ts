/**
 * The provider probe: /test must report the model's actual greeting and a non-negative latency, and
 * must surface a placeholder rather than an empty string when the model says nothing.
 */
import { describe, expect, test } from "bun:test";
import { pingProvider } from "./probe";
import type { ChatFn } from "./provider";

const chatSaying = (text: string): ChatFn => async () => ({ kind: "say", text });

describe("pingProvider", () => {
  test("returns the greeting (trimmed) and a non-negative latency", async () => {
    const probe = await pingProvider(chatSaying("  Curtain's up. I hear you fine.  "));
    expect(probe.text).toBe("Curtain's up. I hear you fine.");
    expect(probe.ms).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(probe.ms)).toBe(true);
  });

  test("an empty reply becomes an explicit placeholder, never a bare blank", async () => {
    const probe = await pingProvider(chatSaying("   "));
    expect(probe.text).toBe("(the model replied with no text)");
  });

  test("it sends exactly one message and no tools", async () => {
    let seenTools: unknown;
    let seenMessages: unknown;
    const spy: ChatFn = async (messages, tools) => {
      seenMessages = messages;
      seenTools = tools;
      return { kind: "say", text: "hi" };
    };
    await pingProvider(spy);
    expect((seenMessages as unknown[]).length).toBe(1);
    expect((seenTools as unknown[]).length).toBe(0);
  });
});
