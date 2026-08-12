/**
 * Will this markup actually draw here? Asked before it is saved, not after it is in a chat log.
 *
 * WHY IT IS ITS OWN TOOL. The seal strips form controls, refuses every http(s) reference and never
 * runs a handler - and none of that announces itself. A wireframe with a <button> keeps its label
 * as bare text and loses its shape; a card whose portrait is a remote URL draws an empty box. Both
 * look correct in the reply and wrong on screen, which is the worst possible place to find out.
 *
 * IT ANSWERS FOR ANY MARKUP, whoever wrote it: a drawing about to be saved, the output half of a
 * regex rule, a chunk of a card's backgroundHTML. That is why it takes text rather than a piece id.
 *
 * IT IS NOT A SECURITY CHECK, and must never be described as one. The sanitizer and the iframe CSP
 * do the enforcing; this reads the same policy in advance so an author can fix a design. A clean
 * report means "this should draw", never "this is safe to trust".
 */
import { z } from "zod";
import { readSeal, sealNotes, SEALED_FORBID_TAGS } from "../../core/render/seal-policy";
import type { HarnessTool, ToolResult } from "./tool";

const input = z.strictObject({
  html: z.string().min(1).max(200_000)
    .describe("the markup to check: a drawing, a rule's replacement, any fragment"),
});

type Input = z.infer<typeof input>;

const htmlWillDraw: HarnessTool<Input> = {
  name: "html_will_draw",
  description:
    "Check markup against what the studio's sealed frame actually draws, before saving it. Reports "
    + "the tags it strips (form controls among them), http(s) images and fonts that cannot load, "
    + "and event handlers that never fire. Reach for it after writing a wireframe or the output "
    + "half of a regex rule. It is advice about rendering, not a safety verdict.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "regex-lab",

  async execute(args: Input): Promise<ToolResult> {
    const report = readSeal(args.html);
    if (report.clean) {
      return {
        summary: "html_will_draw: nothing here is stripped",
        output:
          "Nothing in this markup is removed by the seal, and nothing in it needs the network. "
          + "All CSS renders, including a <style> block in the head. This says it will DRAW; it is "
          + "not a statement about whether the content is safe or correct.",
      };
    }
    const lines = sealNotes(report).map((note) => `- ${note}`);
    lines.push("");
    lines.push(
      `The seal always strips: ${SEALED_FORBID_TAGS.join(", ")}. Everything else draws, and all `
      + "CSS works.",
    );
    return {
      summary: `html_will_draw: ${report.stripped.length} stripped tag(s), `
        + `${report.remote.length} dead reference(s)`,
      output: lines.join("\n"),
    };
  },
};

export default htmlWillDraw;
