/** Regression coverage for the chat-import.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { parseChatJsonl } from "./chat-import";
import { readFileSync } from "fs";
import { join } from "path";

describe("parseChatJsonl", () => {
  test("parses ST-shaped lines and skips junk", () => {
    const raw = [
      '{"name":"User","is_user":true,"mes":"hello powers"}',
      "not-json",
      '{"name":"Char","is_user":false,"mes":"hi"}',
      '{"foo":1}',
      "",
    ].join("\n");
    const r = parseChatJsonl(raw);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toEqual({ text: "hello powers", role: "user" });
    expect(r.lines[1]?.role).toBe("assistant");
    expect(r.skipped).toBe(2);
    expect(r.speakers).toContain("User");
  });

  test("golden-chat fixture loads", () => {
    const path = join(import.meta.dir, "fixtures", "golden-chat.jsonl");
    const raw = readFileSync(path, "utf8");
    const r = parseChatJsonl(raw);
    expect(r.lines.length).toBeGreaterThanOrEqual(3);
    expect(r.lines.some((l) => l.text.includes("powers"))).toBe(true);
  });
});
