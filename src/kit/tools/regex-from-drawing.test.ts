/**
 * The two drawing-to-regex tools, through their own front door.
 *
 * The transcription arithmetic is proven in core/regex/drawing-template.test.ts. What is proven here
 * is the part a model actually experiences: a real drawing read out of the studio, a pattern that
 * matches nothing being CALLED a failure rather than reported as a clean run, and a design whose
 * controls will not survive the seal being told so before anything is saved.
 */
import { describe, expect, test } from "bun:test";
import fromDrawing from "./regex-from-drawing";
import willDraw from "./html-will-draw";
import type { ToolContext } from "./tool";

const DRAWING = "<!doctype html><html><head><style>.card{color:#eef4ff}</style></head>"
  + "<body><div class=\"card\"><b>{{NAME}}</b><span>{{GRAVITY}} / 5</span><i>cost $5</i></div></body></html>";

const ctxWith = (html: string | null): ToolContext => ({
  bridge: {
    read: async (kind: string, id: string) =>
      html === null || kind !== "htmldoc" ? null : { kind, id, body: { name: "Astral card", html } },
  },
} as unknown as ToolContext);

const run = (args: Record<string, unknown>, ctx: ToolContext = ctxWith(DRAWING)) =>
  fromDrawing.execute(fromDrawing.input.parse(args), ctx);

describe("regex_from_drawing", () => {
  test("reads a saved drawing and hands back a replacement that is one line", async () => {
    const result = await run({
      drawing: "astral-card",
      slots: [{ mark: "{{NAME}}", group: 1 }, { mark: "{{GRAVITY}}", group: 2 }],
    });
    expect(result.output).toContain("$1");
    expect(result.output).toContain("$2");
    // The author's own dollar survived as a literal, which is the whole point of escaping first.
    expect(result.output).toContain("cost $$5");
    expect(result.output).toContain("Astral card");
    // One line: a rule row holds one line in every format this writes.
    const replace = result.output.split("REPLACE\n")[1]?.split("\n")[0] ?? "";
    expect(replace).toContain("<div class=\"card\">");
    expect(replace).not.toContain("\n");
  });

  test("names a drawing that is not there rather than building from nothing", async () => {
    const result = await run({ drawing: "not-a-drawing" }, ctxWith(null));
    expect(result.summary).toContain("no drawing");
    expect(result.output).toContain("Nothing was built");
  });

  test("A PATTERN THAT MATCHES NOTHING IS A FAILURE, not a quiet clean run", async () => {
    // The shape this whole surface exists to prevent: text back unchanged and no complaint, which
    // reads as "the rule works" to anybody who does not diff it.
    const result = await run({
      drawing: "astral-card",
      slots: [{ mark: "{{NAME}}", group: 1 }, { mark: "{{GRAVITY}}", group: 2 }],
      find: "<astral name=\"([^\"]+)\" gravity=\"(\\d)\">",
      sample: "nothing here looks like that tag",
    });
    expect(result.summary).toContain("matched nothing");
    expect(result.output).toContain("not a pass");
  });

  test("runs the finished pair through the real engine and shows what it produced", async () => {
    const result = await run({
      drawing: "astral-card",
      slots: [{ mark: "{{NAME}}", group: 1 }, { mark: "{{GRAVITY}}", group: 2 }],
      find: "<astral name=\"([^\"]+)\" gravity=\"(\\d)\">",
      sample: "before <astral name=\"Mara\" gravity=\"4\"> after",
    });
    expect(result.summary).toContain("matched 1 time");
    expect(result.output).toContain("<b>Mara</b>");
    expect(result.output).toContain("<span>4 / 5</span>");
    // And the literal dollar came out as one dollar, not as an empty capture.
    expect(result.output).toContain("cost $5");
  });

  test("a slot pointing past the pattern's groups is named before it prints nothing", async () => {
    const result = await run({
      drawing: "astral-card",
      slots: [{ mark: "{{NAME}}", group: 1 }, { mark: "{{GRAVITY}}", group: 4 }],
      find: "<astral name=\"([^\"]+)\">",
      sample: "<astral name=\"Mara\">",
    });
    expect(result.output).toContain("SLOTS WITH NO GROUP");
    expect(result.output).toContain("$4");
  });

  test("says what the seal will strip from the design itself", async () => {
    const result = await run({ html: "<div><button class=\"pill\">Reveal</button></div>" });
    expect(result.output).toContain("WILL NOT DRAW AS WRITTEN");
    expect(result.output).toContain("button");
  });

  test("a pattern the validator refuses is never run", async () => {
    const result = await run({
      html: "<b>{{N}}</b>",
      slots: [{ mark: "{{N}}", group: 1 }],
      find: "(a+)+$",
      sample: "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!",
    });
    expect(result.summary).toContain("refused");
    expect(result.output).toContain("PATTERN REFUSED");
  });

  test("it is a read: no draft, no write", () => {
    expect(fromDrawing.effect).toBe("read");
  });
});

describe("html_will_draw", () => {
  const check = (html: string) => willDraw.execute(willDraw.input.parse({ html }), {} as ToolContext);

  test("a plain drawing draws, and the answer does not claim to be a safety verdict", async () => {
    const result = await check("<div class=\"card\"><style>.card{color:red}</style>Hi</div>");
    expect(result.summary).toContain("nothing here is stripped");
    expect(result.output).toContain("not a statement about whether the content is safe");
  });

  test("names the controls it strips and what to do instead", async () => {
    const result = await check("<form><input value=\"x\"><button>Go</button></form>");
    expect(result.output).toContain("form");
    expect(result.output).toContain("input");
    expect(result.output).toContain("button");
    expect(result.output).toContain("styled div or span");
  });

  test("names a remote reference that will simply not load", async () => {
    const result = await check("<img src=\"https://example.test/a.png\">");
    expect(result.output).toContain("https://example.test/a.png");
    expect(result.output).toContain("data: URI");
  });

  test("names a handler that will never fire", async () => {
    const result = await check("<div onclick=\"go()\">tap</div>");
    expect(result.output).toContain("onclick");
    expect(result.output).toContain("scripts are off");
  });
});
