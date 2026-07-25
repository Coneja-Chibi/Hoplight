/** Transcript export tests for stable filenames and readable session text. */
import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "../providers/provider";
import { appendTurn, buildTurn, emptySession, renameSession, type Session } from "./session-model";
import { formatTranscript, sanitizeFilename } from "./transcript";

const msg = (content: string, role: ModelMessage["role"] = "user"): ModelMessage => ({ role, content });

// updatedAt fixed to a known UTC day for a stable date stamp.
const DAY = Date.UTC(2026, 6, 23, 12, 0, 0); // 2026-07-23

const combat = (): Session => {
  let s = emptySession("root", DAY);
  s = appendTurn(
    s,
    buildTurn("set up combat", [msg("set up combat"), msg("Ready.", "assistant")], DAY),
  );
  return renameSession(s, "draw steel combat math", DAY);
};

describe("sanitizeFilename", () => {
  test("lowercases and hyphenates a plain title", () => {
    expect(sanitizeFilename("Draw Steel Combat Math")).toBe("draw-steel-combat-math");
  });

  test("collapses path traversal to a safe slug", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32")).toBe("windows-system32");
  });

  test("an all-special title falls back to 'session'", () => {
    expect(sanitizeFilename("***")).toBe("session");
    expect(sanitizeFilename("   ")).toBe("session");
  });

  test("caps length and never leaves a trailing hyphen", () => {
    const out = sanitizeFilename(`${"a".repeat(80)} tail`);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("-")).toBe(false);
  });
});

describe("formatTranscript", () => {
  test("markdown carries the title, turn count, and you/reply blocks", () => {
    const { filename, body } = formatTranscript(combat(), "markdown");
    expect(filename).toBe("draw-steel-combat-math-20260723.md");
    expect(body).toContain("# draw steel combat math");
    expect(body).toContain("_1 turn_");
    expect(body).toContain("## you\n\nset up combat");
    expect(body).toContain("## reply\n\nReady.");
  });

  test("json round-trips back to the exact session", () => {
    const session = combat();
    const { filename, body } = formatTranscript(session, "json");
    expect(filename).toBe("draw-steel-combat-math-20260723.json");
    expect(JSON.parse(body)).toEqual(JSON.parse(JSON.stringify(session)));
  });

  test("an unknown format falls back to markdown", () => {
    expect(formatTranscript(combat(), "xml").filename.endsWith(".md")).toBe(true);
  });

  test("an empty session exports a header-only body without crashing", () => {
    const { body } = formatTranscript(emptySession("empty", DAY), "markdown");
    expect(body).toBe("# Untitled session\n\n_0 turns_\n");
  });

  test("tool calls and results render as fenced blocks", () => {
    let s = emptySession("t", DAY);
    s = appendTurn(
      s,
      buildTurn(
        "search",
        [
          msg("search", "user"),
          { role: "assistant", content: "Looking.", toolCalls: [{ id: "1", name: "grep", args: { q: "x" } }] },
          { role: "tool", content: "3 hits", toolName: "grep", toolCallId: "1" },
        ],
        DAY,
      ),
    );
    const { body } = formatTranscript(s, "markdown");
    expect(body).toContain("```call · grep");
    expect(body).toContain("```tool · grep");
    expect(body).toContain("3 hits");
  });
});
