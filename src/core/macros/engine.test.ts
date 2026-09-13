/**
 * Contract tests for the closed-world macro interpreter (ADR-012).
 *
 * Pins: parser cascade + degradation edge cases (spec edge cases 1-7, 10), span provenance
 * through normalization, seeded determinism, readOnly, bounds, unknown-name passthrough, and
 * the ADR's data-only registry constraint (enforced here, not by review).
 */
import { describe, expect, test } from "bun:test";
import { parseMacroNodes, type ASTNode, type BlockIfNode, type MacroCallNode } from "./parse";
import { normalizeMacroText, toSource } from "./normalize";
import { getAllMacros } from "./registry";
import { processMacros, MAX_OUTPUT_CHARS } from "./evaluate";
import type { MacroContext, MacroSegment, RenderSegment } from "./types";

const ctx = (overrides: Partial<MacroContext> = {}): MacroContext => ({
  characterName: "Seraphina",
  userName: "Chi",
  localVariables: new Map(),
  globalVariables: new Map(),
  randomSeed: 42,
  ...overrides,
});

const at = <T>(items: readonly T[], i: number): T => {
  const v = items[i];
  if (v === undefined) throw new Error(`missing index ${i}`);
  return v;
};
const asMacro = (n: ASTNode): MacroCallNode => {
  if (n.type !== "macro") throw new Error(`expected macro node, got ${n.type}`);
  return n;
};
const asBlockIf = (n: ASTNode): BlockIfNode => {
  if (n.type !== "blockIf") throw new Error(`expected blockIf node, got ${n.type}`);
  return n;
};
const asMacroSeg = (s: RenderSegment): MacroSegment => {
  if (s.kind !== "macro") throw new Error("expected macro segment");
  return s;
};

describe("parser", () => {
  test("plain text is one text node with its span", () => {
    const nodes = parseMacroNodes("hello world");
    expect(nodes).toEqual([{ type: "text", value: "hello world", start: 0, end: 11 }]);
  });

  test("inline macro with nested args keeps spans", () => {
    const src = "a {{if::{{getvar::x}}::yes::no}} b";
    const nodes = parseMacroNodes(src);
    expect(nodes.length).toBe(3);
    const mac = asMacro(at(nodes, 1));
    expect(mac.name).toBe("if");
    expect(mac.args.length).toBe(3);
    expect(src.slice(mac.start, mac.end)).toBe("{{if::{{getvar::x}}::yes::no}}");
  });

  test("unmatched {{ degrades to text (edge case 1)", () => {
    const nodes = parseMacroNodes("before {{oops");
    expect(nodes).toEqual([
      { type: "text", value: "before ", start: 0, end: 7 },
      { type: "text", value: "{{oops", start: 7, end: 13 },
    ]);
  });

  test("triple-brace folding matches the pair scan (edge case 7)", () => {
    const nodes = parseMacroNodes("{{{char}}}");
    expect(asMacro(at(nodes, 0)).rawContent).toBe("{char");
    expect(at(nodes, 1)).toEqual({ type: "text", value: "}", start: 9, end: 10 });
  });

  test("malformed space-form if becomes literal head text (edge case 2)", () => {
    const nodes = parseMacroNodes("{{if x > 1}}body");
    expect(at(nodes, 0)).toEqual({ type: "text", value: "{{if x > 1}}", start: 0, end: 12 });
    expect(at(nodes, 1)).toEqual({ type: "text", value: "body", start: 12, end: 16 });
  });

  test("colon-form if without closer falls through to inline (edge case 3)", () => {
    const nodes = parseMacroNodes("{{if::cond}}");
    expect(asMacro(at(nodes, 0)).name).toBe("if");
  });

  test("multi-arg if:: is the inline conditional, never a block opener", () => {
    const nodes = parseMacroNodes("{{if::a::b}}x{{/if}}");
    expect(asMacro(at(nodes, 0)).args.length).toBe(2);
    // the orphan {{/if}} is silently consumed (edge case 5)
    expect(at(nodes, 1)).toEqual({ type: "text", value: "x", start: 12, end: 13 });
    expect(nodes.length).toBe(2);
  });

  test("block-if with else parses both branches", () => {
    const nodes = parseMacroNodes("{{if x}}A{{else}}B{{/if}}");
    const block = asBlockIf(at(nodes, 0));
    expect(at(block.thenBranch, 0)).toMatchObject({ type: "text", value: "A" });
    expect(at(block.elseBranch, 0)).toMatchObject({ type: "text", value: "B" });
  });

  test("nested inline setvar does not desync a setvar block (edge case 5)", () => {
    const nodes = parseMacroNodes("{{setvar::x}}a{{setvar::y::z}}b{{/setvar}}");
    expect(at(nodes, 0).type).toBe("blockSetvar");
    expect(nodes.length).toBe(1);
  });

  test("comment body containing :: stays one unsplit arg (edge case 18)", () => {
    const nodes = parseMacroNodes("{{// note::with colons}}");
    const mac = asMacro(at(nodes, 0));
    expect(mac.name).toBe("//");
    expect(mac.args.length).toBe(1);
    expect(at(at(mac.args, 0), 0)).toMatchObject({ value: "note::with colons" });
  });
});

describe("normalization provenance", () => {
  test("dot notation rewrites but maps back to the authored tag", () => {
    const src = "HP: {{.hp}} left";
    const n = normalizeMacroText(src);
    expect(n.text).toBe("HP: {{getvar::hp}} left");
    const mac = asMacro(at(parseMacroNodes(n.text), 1));
    const span = toSource(n, mac.start, mac.end);
    expect(src.slice(span.start, span.end)).toBe("{{.hp}}");
  });

  test("angle tokens and single-colon forms normalize", () => {
    expect(normalizeMacroText("<char> and <user>").text).toBe("{{char}} and {{user}}");
    expect(normalizeMacroText("{{getvar:x}}").text).toBe("{{getvar::x}}");
    expect(normalizeMacroText("{{roll 1d20}}").text).toBe("{{roll::1d20}}");
    expect(normalizeMacroText("{{setvar x 5}}").text).toBe("{{setvar::x::5}}");
    expect(normalizeMacroText("{{$score}}").text).toBe("{{getglobalvar::score}}");
  });

  test("escaped braces survive as literals end to end (edge case 8)", () => {
    const src = "literal \\{\\{char\\}\\} stays";
    const result = processMacros(src, ctx());
    expect(result.text).toBe("literal {{char}} stays");
    // The corrupting-edit guard: a literal segment's value IS the authored slice, escapes and
    // all, so splicing an edit into [sourceStart, sourceEnd) can never turn an escaped brace
    // into a live macro tag.
    const seg = at(result.segments, 0);
    if (seg.kind !== "literal") throw new Error("expected literal segment");
    expect(seg.value).toBe(src.slice(seg.sourceStart, seg.sourceEnd));
    expect(seg.value).toBe(src);
  });

  test("newline squashing never leaks into literal segment spans", () => {
    const src = "a\n\n\n\n\nb {{char}}";
    const result = processMacros(src, ctx());
    expect(result.text).toBe("a\n\nb Seraphina");
    const seg = at(result.segments, 0);
    if (seg.kind !== "literal") throw new Error("expected literal segment");
    expect(seg.value).toBe(src.slice(seg.sourceStart, seg.sourceEnd));
    expect(seg.value).toBe("a\n\n\n\n\nb ");
  });
});

describe("evaluator", () => {
  test("identity macros with segment spans", () => {
    const src = "Hello {{char}}, I am {{user}}.";
    const result = processMacros(src, ctx());
    expect(result.text).toBe("Hello Seraphina, I am Chi.");
    expect(result.segments.length).toBe(5);
    const seg = asMacroSeg(at(result.segments, 1));
    expect(seg.raw).toBe("{{char}}");
    expect(src.slice(seg.sourceStart, seg.sourceEnd)).toBe("{{char}}");
    expect(result.cacheable).toBe(true);
  });

  test("seeded random is deterministic and reports its branch", () => {
    const src = "{{random::growls::snarls::hisses}}";
    const a = processMacros(src, ctx());
    const b = processMacros(src, ctx());
    expect(a.text).toBe(b.text);
    expect(["growls", "snarls", "hisses"]).toContain(a.text);
    const seg = asMacroSeg(at(a.segments, 0));
    if (seg.detail?.kind !== "choice") throw new Error("expected choice detail");
    expect(seg.detail.options).toEqual(["growls", "snarls", "hisses"]);
    expect(at(seg.detail.options, seg.detail.chosenIndex)).toBe(a.text);
    expect(a.cacheable).toBe(false);
    const other = processMacros(src, ctx({ randomSeed: 43 }));
    expect(["growls", "snarls", "hisses"]).toContain(other.text);
  });

  test("variables write, read, fingerprint, and poison cacheability", () => {
    const result = processMacros("{{setvar::mood::grim}}{{getvar::mood}}", ctx());
    expect(result.text).toBe("grim");
    expect(result.sideEffects).toEqual([{ type: "setLocalVar", key: "mood", value: "grim" }]);
    expect(result.touchedVariables).toContain("local:mood");
    expect(result.cacheable).toBe(false);

    const pure = processMacros(
      "{{getvar::mood}}",
      ctx({ localVariables: new Map([["mood", { value: "calm", createdAt: 0, updatedAt: 0 }]]) }),
    );
    expect(pure.text).toBe("calm");
    expect(pure.cacheable).toBe(true);
  });

  test("readOnly makes writes no-ops while reads see existing state (edge case 15)", () => {
    const vars = new Map([["x", { value: "kept", createdAt: 0, updatedAt: 0 }]]);
    const result = processMacros(
      "{{setvar::x::1}}{{getvar::x}}",
      ctx({ readOnly: true, localVariables: vars }),
    );
    expect(result.text).toBe("kept");
    expect(vars.get("x")?.value).toBe("kept");
  });

  test("unknown macros pass through literally with one error (edge case 10)", () => {
    const result = processMacros("{{idle_duration}} and {{notreal::a}}", ctx());
    expect(result.text).toBe("{{idle_duration}} and {{notreal::a}}");
    expect(result.errors.length).toBe(2);
  });

  test("block-if short-circuits: untaken side effects never fire (edge case 14)", () => {
    const result = processMacros("{{if::0}}{{setvar::boom::1}}{{else}}safe{{/if}}", ctx());
    expect(result.text).toBe("safe");
    expect(result.sideEffects).toEqual([]);
    const seg = asMacroSeg(at(result.segments, 0));
    if (seg.detail?.kind !== "branch") throw new Error("expected branch detail");
    expect(seg.detail.taken).toBe("else");
  });

  test("condition shorthands resolve variables (edge case 19)", () => {
    const vars = new Map([["hp", { value: "10", createdAt: 0, updatedAt: 0 }]]);
    const result = processMacros("{{if .hp <= 25}}low{{/if}}", ctx({ localVariables: vars }));
    expect(result.text).toBe("low");
  });

  test("self-referential expansion hits the depth cap without hanging (edge case 12)", () => {
    const vars = new Map([["a", { value: "loop {{getvar::a}}", createdAt: 0, updatedAt: 0 }]]);
    const result = processMacros("{{getvar::a}}", ctx({ localVariables: vars }));
    expect(result.text.startsWith("loop")).toBe(true);
    expect(result.text.length).toBeLessThan(1000);
  });

  test("output ceiling truncates instead of exploding", () => {
    const big = "x".repeat(MAX_OUTPUT_CHARS + 5000);
    const result = processMacros(big, ctx());
    expect(result.text.length).toBe(MAX_OUTPUT_CHARS);
    expect(result.errors.some((e) => e.message.includes("ceiling"))).toBe(true);
  });

  test("time macros read the caller's clock value, never the machine's", () => {
    // 2026-08-27T14:30:45Z, pinned - the same context always renders the same moment
    const pinned = ctx({ now: 1787841045000, timezone: "UTC", locale: "en-US" });
    expect(processMacros("{{isodate}} {{isotime}}", pinned).text).toBe("2026-08-27 14:30:45");
    expect(processMacros("{{weekday}}", pinned).text).toBe("Thursday");
    // no clock supplied -> silence, not an invented moment
    expect(processMacros("{{time}}{{date}}{{isodate}}", ctx()).text).toBe("");
    // volatile: a clocked render must not be cached
    expect(processMacros("{{time}}", pinned).cacheable).toBe(false);
  });

  test("chat macros read the stub conversation and default to empty (bucket 2)", () => {
    const chat = ctx({
      messages: [
        { role: "user", content: "{{user}}'s test message" },
        { role: "assistant", content: "a reply" },
      ],
      currentMessage: "test message",
    });
    // handler output carrying macros re-expands, so the stub's {{user}} resolves
    expect(processMacros("{{lastusermessage}}", chat).text).toBe("Chi's test message");
    expect(processMacros("{{lastmessage}} ({{messagecount}})", chat).text).toBe("a reply (2)");
    expect(processMacros("{{input}}", chat).text).toBe("test message");
    // absent context: empty defaults, never errors
    const bare = processMacros("{{lastmessage}}{{messagecount}}{{input}}", ctx());
    expect(bare.text).toBe("0");
    expect(bare.errors).toEqual([]);
  });

  test("scoped and global variables route to the right map", () => {
    const c = ctx({ characterId: "abc" });
    processMacros("{{setvar::char:mood::sly}}{{setglobalvar::theme::noir}}", c);
    expect(c.localVariables.get("_char_abc_mood")?.value).toBe("sly");
    expect(c.globalVariables.get("theme")?.value).toBe("noir");
  });
});

describe("registry (ADR-012 data-only constraint)", () => {
  // `new Date()` with NO argument is the ambient clock and is banned; `new Date(context.now)`
  // wraps a caller-supplied value and is the ADR-compliant spelling.
  const forbidden =
    /\b(require|fetch|XMLHttpRequest|WebSocket|process|Deno|Bun|eval|Function|setTimeout|setInterval|Date\.now|new Date\(\s*\)|Math\.random|crypto|localStorage|import\s*\()\b/;
  const stripComments = (code: string): string =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  test("no handler's own source reaches a forbidden surface", () => {
    for (const def of getAllMacros()) {
      expect({ name: def.name, ok: !forbidden.test(def.handler.toString()) }).toEqual({
        name: def.name,
        ok: true,
      });
    }
  });

  test("the whole package source is data-only, helpers included", async () => {
    // handler.toString() only sees the arrow function itself, never a helper it calls - so the
    // real net is every source file in the package, comments stripped.
    const files = ["types.ts", "normalize.ts", "parse.ts", "scopes.ts", "handlers.ts", "handlers-context.ts", "registry.ts", "evaluate.ts", "index.ts"];
    for (const file of files) {
      const code = stripComments(await Bun.file(new URL(file, import.meta.url)).text());
      const hit = forbidden.exec(code);
      expect({ file, hit: hit?.[0] ?? null }).toEqual({ file, hit: null });
    }
  });

  test("the only randomness import is the seeded stream", async () => {
    // evaluate.ts leans on ../lore/rng, which also exports crypto-backed helpers; only the
    // deterministic one may cross into this package.
    const code = await Bun.file(new URL("evaluate.ts", import.meta.url)).text();
    const rngImport = /import\s*\{([^}]*)\}\s*from\s*"\.\.\/lore\/rng"/.exec(code);
    expect(rngImport?.[1]?.trim()).toBe("mulberry32");
  });
});
