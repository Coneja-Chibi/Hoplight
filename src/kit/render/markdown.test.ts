import { describe, expect, test } from "bun:test";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  test("plain text is one span", () => {
    expect(parseInline("just words")).toEqual([{ t: "text", s: "just words" }]);
  });

  test("bold, italic, code", () => {
    expect(parseInline("a **b** c *d* `e`")).toEqual([
      { t: "text", s: "a " },
      { t: "bold", s: "b" },
      { t: "text", s: " c " },
      { t: "italic", s: "d" },
      { t: "text", s: " " },
      { t: "code", s: "e" },
    ]);
  });

  test("__ is bold, single _ is left alone (snake_case survives)", () => {
    expect(parseInline("__loud__ but user_id stays")).toEqual([
      { t: "bold", s: "loud" },
      { t: "text", s: " but user_id stays" },
    ]);
  });

  test("links keep text and href", () => {
    expect(parseInline("see [docs](https://x.y)")).toEqual([
      { t: "text", s: "see " },
      { t: "link", s: "docs", href: "https://x.y" },
    ]);
  });

  test("unclosed marker is plain (tolerant for streaming)", () => {
    expect(parseInline("half **bold")).toEqual([{ t: "text", s: "half **bold" }]);
  });
});

describe("parseMarkdown", () => {
  test("heading level and text", () => {
    expect(parseMarkdown("## Hi there")).toEqual([
      { t: "heading", level: 2, spans: [{ t: "text", s: "Hi there" }] },
    ]);
  });

  test("consecutive plain lines fold into one paragraph", () => {
    const blocks = parseMarkdown("line one\nline two\n\nnext para");
    expect(blocks).toEqual([
      { t: "para", spans: [{ t: "text", s: "line one line two" }] },
      { t: "para", spans: [{ t: "text", s: "next para" }] },
    ]);
  });

  test("bullets and ordered items", () => {
    const blocks = parseMarkdown("- one\n- two\n1. first");
    expect(blocks).toEqual([
      { t: "bullet", depth: 0, spans: [{ t: "text", s: "one" }] },
      { t: "bullet", depth: 0, spans: [{ t: "text", s: "two" }] },
      { t: "ordered", depth: 0, num: 1, spans: [{ t: "text", s: "first" }] },
    ]);
  });

  test("fenced code keeps lines verbatim, no inline parse", () => {
    const blocks = parseMarkdown("```\nconst x = **1**\n```");
    expect(blocks).toEqual([{ t: "code", lines: ["const x = **1**"] }]);
  });

  test("unterminated fence mid-stream still yields a code block", () => {
    const blocks = parseMarkdown("```\npartial code");
    expect(blocks).toEqual([{ t: "code", lines: ["partial code"] }]);
  });

  test("block quote folds consecutive lines", () => {
    const blocks = parseMarkdown("> a\n> b");
    expect(blocks).toEqual([{ t: "quote", spans: [{ t: "text", s: "a b" }] }]);
  });

  test("horizontal rule", () => {
    expect(parseMarkdown("---")).toEqual([{ t: "hr" }]);
  });
});
