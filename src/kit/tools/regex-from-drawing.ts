/**
 * Turn a saved drawing into the replacement half of a regex rule, and prove it against real text.
 *
 * THE WORKFLOW THIS SERVES. Design the rich thing once as a drawing; write a regex that renders it
 * from whatever compact form the model is asked to produce, so the complexity lives in the script
 * instead of in every reply. The pattern is a judgement call and stays with whoever writes it. The
 * replacement is pure transcription - four thousand characters of markup flattened to one line with
 * every `$` doubled and every slot swapped for a capture reference - and transcription at that
 * length is where a hand-written rule goes quietly wrong: one live `$` renders as nothing, one
 * stray newline breaks the SillyTavern wire form, one slot pointing at a group the pattern never
 * opens prints an empty string forever.
 *
 * IT READS AND REPORTS; IT NEVER SAVES. The rule comes back as text to look at, try, and then save
 * through the create tool that already owns that boundary. `sample` runs the finished pair through
 * the REAL engine, so what comes back is what the rule does rather than what it was meant to do.
 *
 * IT ALSO SAYS WHAT WILL NOT DRAW. A rule whose output carries a <button>, a remote image or an
 * onclick is a rule that looks right in the transcript and loses its shape wherever the studio draws
 * it, because the seal strips exactly those. Better to hear it here than from a chat log.
 */
import { z } from "zod";
import { applyRules, validateRule } from "../../core/regex";
import {
  buildReplacement,
  slotsBeyondPattern,
  type TemplateSlot,
} from "../../core/regex/drawing-template";
import { readSeal, sealNotes } from "../../core/render/seal-policy";
import type { RegexRule } from "../../entities/regex/schema";
import type { HarnessTool, ToolResult } from "./tool";

const input = z.strictObject({
  drawing: z.string().trim().min(1).max(200).optional()
    .describe("the studio id of a saved drawing (htmldoc) to render from"),
  html: z.string().max(200_000).optional()
    .describe("markup to use instead of a saved drawing, when nothing is saved yet"),
  slots: z.array(z.strictObject({
    mark: z.string().min(1).max(80)
      .describe("the literal text in the drawing, e.g. {{NAME}}"),
    group: z.number().int().min(1).max(99)
      .describe("the capture group that fills it, 1-based"),
  })).max(40).default([])
    .describe("where each capture goes; every occurrence of a mark is filled"),
  find: z.string().max(10_000).optional()
    .describe("the pattern, bare and without delimiters; checked against the slots when given"),
  flags: z.string().max(40).default("g").describe("verbatim flags, e.g. g / gi / gs"),
  sample: z.string().max(20_000).optional()
    .describe("compact text the rule should transform, to run the finished pair for real"),
  flatten: z.boolean().default(true)
    .describe("collapse the drawing to one line; a rule row holds one line in every format"),
});

type Input = z.infer<typeof input>;

const MAX_SHOWN = 4_000;

const clip = (text: string): string =>
  text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}\n... ${text.length - MAX_SHOWN} more characters` : text;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const regexFromDrawing: HarnessTool<Input> = {
  name: "regex_from_drawing",
  description:
    "Build the replacement half of a regex rule from a saved drawing: the markup is flattened to "
    + "one line, every literal $ is escaped, and each declared slot becomes a capture reference. "
    + "Reach for it when somebody wants compact model output rendered as a rich card, tracker or "
    + "panel - design it once as a drawing, then render it with a script. Give a find pattern and "
    + "a sample to run the finished pair through the real engine. Nothing is saved.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "regex-lab",

  async execute(args, ctx): Promise<ToolResult> {
    let html = args.html ?? "";
    let source = "the markup you passed";
    if (args.drawing) {
      const piece = await ctx.bridge.read("htmldoc", args.drawing);
      const body: Record<string, unknown> =
        isRec(piece) && isRec(piece["body"]) ? piece["body"] : {};
      const saved = typeof body["html"] === "string" ? body["html"] : null;
      if (saved === null) {
        return {
          summary: `regex_from_drawing: no drawing called "${args.drawing}"`,
          output: `No drawing with that studio id. Use studio_list for kind "htmldoc" to see them, `
            + "or pass html directly. Nothing was built.",
        };
      }
      html = saved;
      const name = typeof body["name"] === "string" ? body["name"] : args.drawing;
      source = `the drawing "${name}"`;
    }
    if (!html.trim()) {
      return {
        summary: "regex_from_drawing: nothing to render",
        output: "Pass either a drawing id or some html. Nothing was built.",
      };
    }

    const slots: TemplateSlot[] = args.slots.map((s) => ({ mark: s.mark, group: s.group }));
    const built = buildReplacement(html, slots, args.flatten);

    const lines: string[] = [];
    lines.push(`From ${source}: ${built.replace.length} characters of replacement.`);
    lines.push("");
    lines.push("REPLACE");
    lines.push(clip(built.replace));
    for (const warning of built.warnings) lines.push(`- ${warning}`);

    // What the seal takes out. Read on the DRAWING, so the report is about the design rather than
    // about one sample's output - a control is stripped whether or not this sample happens to hit it.
    const notes = sealNotes(readSeal(html));
    if (notes.length > 0) {
      lines.push("");
      lines.push("WILL NOT DRAW AS WRITTEN");
      for (const note of notes) lines.push(`- ${note}`);
    }

    if (!args.find) {
      lines.push("");
      lines.push(
        "No pattern given, so nothing was tried. Pass find (and a sample) to run the pair through "
        + "the real engine before you save it.",
      );
      return { summary: `regex_from_drawing: replacement built from ${source}`, output: lines.join("\n") };
    }

    const beyond = slotsBeyondPattern(args.find, slots);
    if (beyond.length > 0) {
      lines.push("");
      lines.push("SLOTS WITH NO GROUP");
      for (const miss of beyond) {
        lines.push(
          `- $${miss.group} is asked for, but the pattern opens ${miss.groups} capture group(s). `
          + "That reference renders as an empty string on every message.",
        );
      }
    }

    const draft: RegexRule = {
      id: "drawing-rule",
      label: "drawing rule",
      find: args.find,
      flags: args.flags,
      replace: built.replace,
      enabled: true,
      sortOrder: 0,
      phases: ["display"],
    };
    // The validator refuses catastrophic backtracking; a pattern it rejects must never be run here.
    const check = validateRule(draft);
    if (!check.ok) {
      lines.push("");
      lines.push(`PATTERN REFUSED: ${check.error ?? "unsafe pattern"}`);
      return {
        summary: "regex_from_drawing: the pattern was refused, so nothing was tried",
        output: lines.join("\n"),
      };
    }

    if (args.sample === undefined) {
      lines.push("");
      lines.push("The pattern is valid. Pass a sample to see what the pair actually produces.");
      return { summary: `regex_from_drawing: replacement built from ${source}`, output: lines.join("\n") };
    }

    const run = applyRules(args.sample, [draft], { phase: "display" });
    const trace = run.traces[0];
    lines.push("");
    // Counted, not inferred from `applied`: a rule can run cleanly and match nothing, which is the
    // failure that reads as success - text back unchanged and no complaint anywhere.
    if (!trace || trace.matchCount === 0) {
      lines.push(
        `THE PATTERN MATCHED NOTHING in that sample${trace?.skipReason ? ` (${trace.skipReason})` : ""}. `
        + "The text came back untouched, which is not a pass - the rule would do nothing to a real "
        + "message either.",
      );
      return {
        summary: "regex_from_drawing: built, but the pattern matched nothing",
        output: lines.join("\n"),
      };
    }

    lines.push(`MATCHED ${trace.matchCount} time(s). OUTPUT`);
    lines.push(clip(run.text));
    const outNotes = sealNotes(readSeal(run.text));
    if (outNotes.length > 0) {
      lines.push("");
      lines.push("IN THIS OUTPUT");
      for (const note of outNotes) lines.push(`- ${note}`);
    }
    return {
      summary: `regex_from_drawing: built and matched ${trace.matchCount} time(s)`,
      output: lines.join("\n"),
    };
  },
};

export default regexFromDrawing;
