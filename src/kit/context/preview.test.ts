/**
 * The /context preview.
 *
 * The risk this command exists to remove is a person not knowing what rides on their turn, so the
 * tests are about disclosure and about not overclaiming: the system text must appear in full rather
 * than as a count, the numbers must be labelled as estimates, and an unknown context window must read
 * as unknown rather than as headroom.
 */
import { describe, expect, test } from "bun:test";
import type { ModelMessage, ToolSpec } from "../providers/provider";
import { contextParts, estimateTokens, formatContextPreview, messageTokens } from "./preview";

const SYSTEM = "You are Kit. Use tools for Studio facts and changes.";

const TOOLS: ToolSpec[] = [
  { name: "studio_read", description: "Read one entity.", schema: { type: "object", properties: { id: { type: "string" } } } },
  { name: "studio_list", description: "List entities.", schema: { type: "object", properties: {} } },
];

const MESSAGES: ModelMessage[] = [
  { role: "user", content: "convert my preset" },
  { role: "assistant", content: "", toolCalls: [{ id: "1", name: "studio_read", args: { id: "abc" } }] },
  { role: "tool", content: "a long tool observation".repeat(20), toolCallId: "1", toolName: "studio_read" },
  { role: "assistant", content: "Here is what I found." },
];

const snapshot = (over: Partial<Parameters<typeof formatContextPreview>[0]> = {}) => ({
  system: SYSTEM,
  tools: TOOLS,
  messages: MESSAGES,
  ...over,
});

describe("estimates", () => {
  test("a message carries its tool calls, not just its text", () => {
    // A turn whose whole payload is a tool call reads as free if only `content` is counted.
    const bare: ModelMessage = { role: "assistant", content: "" };
    const withCall = MESSAGES[1]!;
    expect(messageTokens(bare)).toBe(0);
    expect(messageTokens(withCall)).toBeGreaterThan(0);
  });

  test("a tool's schema is counted, since it is usually the bulk of the belt", () => {
    const withSchema = contextParts(snapshot()).find((p) => p.label === "tool belt")!;
    const withoutSchemas = contextParts(snapshot({
      tools: TOOLS.map((t) => ({ ...t, schema: {} })),
    })).find((p) => p.label === "tool belt")!;
    expect(withSchema.tokens).toBeGreaterThan(withoutSchemas.tokens);
  });

  test("empty text costs nothing", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("formatContextPreview", () => {
  test("prints the system guidance IN FULL, not as a count", () => {
    // The whole point of the command. Reporting "system guidance: 14 tokens" would disclose that
    // something is there while still hiding what it says.
    const text = formatContextPreview(snapshot());
    expect(text).toContain(SYSTEM);
    expect(text).toContain("you did not write it");
  });

  test("names every tool that would be offered", () => {
    const text = formatContextPreview(snapshot());
    for (const tool of TOOLS) expect(text).toContain(tool.name);
  });

  test("says the numbers are estimates", () => {
    // There is no tokenizer here. Presenting these as exact would be a precision we do not have.
    expect(formatContextPreview(snapshot())).toContain("estimates");
  });

  test("an unknown context window reads as unknown, never as headroom", () => {
    const text = formatContextPreview(snapshot());
    expect(text).toContain("did not report a context window");
    expect(text).not.toContain("% of the window");
  });

  test("a known window is shown as a share of it", () => {
    const text = formatContextPreview(snapshot({ contextWindow: 200_000 }));
    expect(text).toMatch(/% of the window/);
    expect(text).toContain("200k");
  });

  test("a pending message is counted and marked as not yet sent", () => {
    const text = formatContextPreview(snapshot({ pending: "and export it" }));
    expect(text).toContain("your next message");
    expect(text).toContain("not sent yet");
  });

  test("an empty session still reports the parts that ride on every turn", () => {
    // A fresh session sends guidance and a belt before the person has typed anything, which is
    // exactly the case where somebody would wrongly assume nothing is being sent.
    const text = formatContextPreview({ system: SYSTEM, tools: TOOLS, messages: [] });
    expect(text).toContain("nothing yet");
    expect(text).toContain(SYSTEM);
  });

  test("a session with no tools says so rather than printing an empty list", () => {
    const text = formatContextPreview({ system: SYSTEM, tools: [], messages: MESSAGES });
    expect(text).toContain("no tools offered");
    expect(text).not.toContain("**Tools offered**");
  });

  test("the roles are broken out, so a transcript full of tool results reads as one", () => {
    const text = formatContextPreview(snapshot());
    expect(text).toContain("1 user turn");
    expect(text).toContain("2 replies");
    expect(text).toContain("1 tool result");
  });
});
