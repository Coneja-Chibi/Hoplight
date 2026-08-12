/**
 * The transcription a model gets wrong, proven at the character level.
 *
 * Every case here is a way a hand-written replacement fails silently: a live `$` eaten at render
 * time, our own capture reference doubled by our own escaping, a slot that points at a group the
 * pattern never opens. None of these show up as an error - they show up as a card that renders
 * with a word missing, three days later.
 */
import { describe, expect, test } from "bun:test";
import {
  buildReplacement,
  countCaptureGroups,
  escapeReplacement,
  oneLine,
  slotsBeyondPattern,
} from "./drawing-template";

describe("escapeReplacement", () => {
  test("a literal dollar survives as a literal dollar", () => {
    // Unescaped, "$5" reads as capture five and prints nothing at all.
    expect(escapeReplacement("costs $5")).toBe("costs $$5");
    expect("costs $5".replace(/x?/, "")).toBeDefined();
    expect("A".replace(/A/, escapeReplacement("$& and $1 and $$"))).toBe("$& and $1 and $$");
  });
});

describe("oneLine", () => {
  /**
   * A SPACE BETWEEN TAGS IS RENDERED TEXT. Deleting it is the tempting version of this function and
   * it is wrong: a pretty-printed drawing separates `</b>` from `<span>` with a newline, the browser
   * draws that as a space, and a rule built from the deleting version prints "Hardlocks" on every
   * message. One space collapses the file without changing a single rendered character.
   */
  test("every run of whitespace becomes one space, never nothing", () => {
    const { text } = oneLine("<div>\n  <b>Hard</b>\n  <span>two   words</span>\n</div>");
    expect(text).toBe("<div> <b>Hard</b> <span>two words</span> </div>");
  });

  test("CSS survives being flattened, because CSS does not care about newlines", () => {
    const { text } = oneLine("<style>\n.card {\n  color: red;\n}\n</style><b>x</b>");
    expect(text).toBe("<style> .card { color: red; } </style><b>x</b>");
  });

  test("a drawing with <pre> keeps its lines, because there a newline is content", () => {
    const src = "<pre>\n  one\n  two\n</pre>";
    const { text, kept } = oneLine(src);
    expect(kept).toBe(true);
    expect(text).toBe(src);
  });
});

describe("buildReplacement", () => {
  test("slots become capture references and the author's own dollars stay literal", () => {
    const built = buildReplacement(
      "<div class=\"card\"><b>{{NAME}}</b><span>{{GRAVITY}}/5</span><i>costs $5</i></div>",
      [{ mark: "{{NAME}}", group: 1 }, { mark: "{{GRAVITY}}", group: 2 }],
    );
    expect(built.replace).toBe(
      "<div class=\"card\"><b>$1</b><span>$2/5</span><i>costs $$5</i></div>",
    );
    expect(built.warnings).toEqual([]);
  });

  test("THE ORDER: escaping runs first, so our own capture references are not doubled", () => {
    // Substituting first and escaping after turns "$1" into "$$1", which prints the text "$1".
    const built = buildReplacement("<b>{{NAME}}</b>", [{ mark: "{{NAME}}", group: 1 }]);
    expect(built.replace).toBe("<b>$1</b>");
    expect(built.replace).not.toContain("$$1");
    // And it really behaves as a capture reference through the engine's own replace.
    expect("Mara".replace(/(\w+)/, built.replace)).toBe("<b>Mara</b>");
  });

  test("a slot the drawing does not contain is named rather than dropped", () => {
    const built = buildReplacement("<b>{{NAME}}</b>", [
      { mark: "{{NAME}}", group: 1 },
      { mark: "{{TITLE}}", group: 2 },
    ]);
    expect(built.unusedSlots).toEqual(["{{TITLE}}"]);
    expect(built.warnings.join(" ")).toContain("{{TITLE}}");
  });

  test("an undeclared mark left in the output is reported, not silently shipped", () => {
    const built = buildReplacement("<b>{{NAME}}</b><i>{{AIM}}</i>", [{ mark: "{{NAME}}", group: 1 }]);
    expect(built.unfilled).toEqual(["{{AIM}}"]);
    expect(built.replace).toContain("{{AIM}}");
  });

  test("every occurrence of a slot is filled, not just the first", () => {
    const built = buildReplacement("<b>{{N}}</b><aside title=\"{{N}}\">x</aside>", [
      { mark: "{{N}}", group: 1 },
    ]);
    expect(built.replace).toBe("<b>$1</b><aside title=\"$1\">x</aside>");
  });
});

describe("countCaptureGroups", () => {
  test("counts real groups and ignores the ones that capture nothing", () => {
    expect(countCaptureGroups("(a)(b)")).toBe(2);
    expect(countCaptureGroups("(?:a)(b)")).toBe(1);
    expect(countCaptureGroups("(?=a)(?!b)(?<=c)(?<!d)(e)")).toBe(1);
    expect(countCaptureGroups("(?<name>a)")).toBe(1);
    expect(countCaptureGroups("\\(literal\\)(a)")).toBe(1);
    // A paren inside a character class is a literal, not a group.
    expect(countCaptureGroups("[(](a)")).toBe(1);
  });
});

describe("slotsBeyondPattern", () => {
  test("a slot pointing past the pattern's groups is caught before it prints nothing", () => {
    const slots = [{ mark: "{{A}}", group: 1 }, { mark: "{{B}}", group: 3 }];
    expect(slotsBeyondPattern("<x name=\"([^\"]+)\" aim=\"([^\"]+)\">", slots))
      .toEqual([{ group: 3, groups: 2 }]);
  });

  test("nothing to say when every slot has a group", () => {
    expect(slotsBeyondPattern("(a)(b)", [{ mark: "{{A}}", group: 2 }])).toEqual([]);
  });
});
