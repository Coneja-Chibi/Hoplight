/**
 * A reply, actually rendered.
 *
 * The core test proves the link policy. This one proves the thing the policy cannot: that the
 * MARKUP built from a model's words is inert. A parser can be perfectly correct and the renderer
 * still hand the document a `<script>`, and no amount of unit testing the parser would notice.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { KitMarkdown } from "./kit-markdown";

const html = (text: string): string => renderToStaticMarkup(<KitMarkdown text={text} />);

describe("model output is text, never markup", () => {
  test("A SCRIPT TAG IN A REPLY IS A SCRIPT TAG ON THE SCREEN", () => {
    const out = html("Here you go: <script>alert(1)</script>");
    // Escaped, so the document never parses it as an element.
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>");
  });

  test("an event handler smuggled as an attribute never becomes one", () => {
    const out = html('<img src=x onerror="alert(1)"> and <div onclick="alert(2)">hi</div>');
    // The angle brackets are escaped, so neither ever opens an element - `onerror=` survives only
    // as the visible characters of a sentence, which is exactly what it should be.
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<div onclick");
    expect(out).toContain("&lt;img");
    expect(out).toContain("&lt;div onclick=&quot;alert(2)&quot;&gt;");
  });

  test("a javascript: link keeps its words and loses its click", () => {
    const out = html("[click me](javascript:alert(1))");
    expect(out).toContain("click me");
    // No anchor and no href: the refused target survives only as an inert tooltip, which is the
    // information a reader wants precisely when a link was refused.
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href=");
    expect(out).toContain("kit-md__deadlink");
  });

  test("an ordinary link is an anchor that cannot reach back", () => {
    const out = html("see [the docs](https://example.com/x)");
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });
});

describe("the blocks Kit draws", () => {
  test("headings, lists, quotes, rules and inline runs all render as their own thing", () => {
    const out = html(
      "# Title\n\nplain **bold** and *italic* and `code`\n\n- one\n- two\n\n1. first\n\n> quoted\n\n---",
    );
    expect(out).toContain("kit-md__head");
    expect(out).toContain("<strong");
    expect(out).toContain("<em");
    expect(out).toContain("<code");
    expect(out).toContain("kit-md__li");
    expect(out).toContain("kit-md__quote");
    expect(out).toContain("<hr");
  });

  test("EVERY HEADING LEVEL LOOKS THE SAME, so a model cannot shout", () => {
    // Kit's treatment: bold and bright, whatever the level. `######` is not a volume control.
    expect(html("# one")).toContain("kit-md__head");
    expect(html("###### six")).toContain("kit-md__head");
    expect(html("###### six")).not.toContain("<h6");
  });

  test("a fenced patch becomes a counted diff, not a grey slab", () => {
    const out = html("```diff\n--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n+new\n```");
    expect(out).toContain("DIFF");
    expect(out).toContain("+1");
    expect(out).toContain("-1");
    expect(out).toContain("var(--kit-alive)");
    expect(out).toContain("var(--kit-red)");
  });

  test("ORDINARY ARITHMETIC IS NOT PAINTED AS A PATCH", () => {
    // Kit's recogniser needs an explicit fence, or a hunk header plus both kinds of changed line.
    const out = html("```\n1 + 2\n- 3\n```");
    expect(out).not.toContain("DIFF");
  });

  test("a huge patch is cut at Kit's cap and says how much was cut", () => {
    const body = Array.from({ length: 200 }, (_, i) => `+line${String(i)}`).join("\n");
    const out = html(`\`\`\`diff\n@@ -1 +1 @@\n-gone\n${body}\n\`\`\``);
    expect(out).toContain("more lines");
    expect(out).not.toContain("line150");
  });

  test("a reply that is still streaming renders rather than breaking", () => {
    // The parser is tolerant on purpose; an unclosed fence arrives on every single turn.
    const out = html("working on it\n\n```ts\nconst x = 1");
    expect(out).toContain("const x = 1");
  });
});
