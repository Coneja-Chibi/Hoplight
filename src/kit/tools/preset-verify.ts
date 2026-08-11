/**
 * "Does this preset actually resolve?" answered by the target's own engine, not by us.
 *
 * Every other check Hoplight makes is structural: the translator reports what it rewrote, transfer
 * reports what has no counterpart. None of that is the same as SillyTavern assembling the file and
 * telling you what survived. A conversion can pass every check we own and still put a raw macro in
 * somebody's prompt, which is exactly the defect found in a hand-built preset that all of our own
 * checks passed.
 *
 * So this tool asks the engine. It is the one capability no other preset editor has, because nobody
 * else runs the target.
 *
 * READ-ONLY AND OFF-MACHINE. It spawns an adapter that drives an engine already installed here; it
 * writes nothing and touches no studio state, which is why it needs no gate. The engine has to be
 * present, so an absent one is a refusal that names what to install rather than a silent pass.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import {
  availableEngines,
  installRoot,
  rendererCommand,
  RENDER_ENGINES,
} from "../../core/preset/render/engines";

const input = z.strictObject({
  engine: z.enum(["sillytavern", "marinara"])
    .describe("whose macro engine should assemble the preset"),
  preset: z.string().trim().min(1).max(200)
    .describe("the preset's studio id, the same id every other tool takes"),
  state: z.record(z.string(), z.string()).optional()
    .describe("variables or choices to pre-set, in the engine's own naming"),
});

const presetVerify: HarnessTool<z.infer<typeof input>> = {
  name: "preset_verify",
  description:
    "Assemble a preset through the target platform's real macro engine and report every macro that "
    + "did not resolve. Reach for it AFTER changing macros or converting between platforms, when a "
    + "structural check cannot see whether the engine will expand them. It has nothing to say about "
    + "edits that add no macros - a comment block, a rename, reordering - so do not spend a step on "
    + "those. Requires a local engine checkout, and is only offered when this machine has one.",
  exposure: "direct",
  /**
   * OFFERED ONLY WHERE AN ENGINE LIVES. Without a checkout this can verify nothing, and being in
   * the belt anyway cost a step to discover - after several more spent guessing a path.
   */
  available: async () => (await availableEngines()).length > 0,
  effect: "read",
  input,
  // One engine at a time: each render spawns a process, and two of the same engine gains nothing.
  concurrencyKey: ({ engine }) => `render/${engine}`,
  async execute(args, ctx) {
    /**
     * The preset path is the one argument here that names a file anywhere on the machine, so it is
     * checked against the folders the user actually shared. Reading is all this tool ever does, but
     * "only reads" is not the same promise as "only reads what you pointed me at".
     *
     * The studio is always readable, since that is Kit's own working directory and every other tool
     * reaches it freely.
     */
    /**
     * BY ID, NOT BY PATH.
     *
     * This used to take a filesystem path in the platform's own wire format, which asked the model
     * for two things it has no way to know: where the studio lives, and what the file is called -
     * and a foreign piece's filename can be a bare hash. It guessed, repeatedly, and each guess
     * cost a step. Kit knows both, so Kit answers both.
     */
    const entity = await ctx.bridge.read("preset", args.preset);
    if (!entity) {
      return {
        summary: "preset_verify: no such preset",
        output: `No preset called "${args.preset}" in the studio. Use its studio id.`,
      };
    }

    // The engine comes last, because it is the only check whose answer depends on this machine rather
    // than on the request. Asking it first let an out-of-bounds path return "engine not available"
    // and never reach the boundary at all.
    const spec = RENDER_ENGINES[args.engine];
    const root = await installRoot(args.engine);
    if (!root) {
      return {
        summary: `preset_verify ${args.engine}: engine not available`,
        output: `No ${args.engine} engine on this machine. Set ${spec.rootVar} to ${spec.install} and `
          + "try again. Nothing was checked, so do not treat this as a pass.",
      };
    }

    /**
     * The engine reads a FILE in the platform own wire format, so the canonical entity is exported
     * to a temporary one. Kit owns this path start to finish, which is why the containment check
     * that guarded the old caller-supplied path is gone rather than weakened: there is no longer a
     * string from the model naming a file anywhere on the machine.
     */
    const { toWireFile } = await import("./preset-verify-export");
    const exported = await toWireFile(entity, args.engine);
    if (!exported.ok) {
      return {
        summary: `preset_verify ${args.engine}: cannot export`,
        output: `${args.preset} could not be written as ${args.engine}: ${exported.detail}. Nothing was verified.`,
      };
    }

    const { runRenderer } = await import("../../core/preset/render/runner");
    const { unresolvedCount } = await import("../../core/preset/render/contract");
    try {
      const outcome = await runRenderer(
        rendererCommand(args.engine, root),
        { preset: exported.path, ...(args.state ? { state: args.state } : {}) },
        { timeoutMs: 180_000 },
      );

      if (!outcome.ok) {
        // A refusal is reported as a refusal. Reading it as "nothing unresolved" is the one failure
        // this whole feature exists to prevent.
        return {
          summary: `preset_verify ${args.engine}: ${outcome.reason}`,
          output: `The ${args.engine} engine did not finish: ${outcome.detail}. Nothing was verified.`,
        };
      }

      const total = unresolvedCount(outcome);
      const detail = {
        engine: `${outcome.engine.name} ${outcome.engine.version}`,
        promptChars: outcome.prompt.length,
        unresolved: outcome.unresolved.map((u) => ({ token: u.token, count: u.count })),
        warnings: outcome.warnings.slice(0, 10),
      };
      return {
        summary: total === 0
          ? `preset_verify ${args.engine}: clean`
          : `preset_verify ${args.engine}: ${total} unresolved`,
        output: JSON.stringify(detail),
      };
    } finally {
      // The export is scratch, and a verifier that litters the disk on every call is its own bug.
      await exported.cleanup();
    }
  },
};

export default presetVerify;
