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
import { join } from "node:path";
import type { HarnessTool } from "./tool";
import { checkGrantReal, grantFolder } from "./_shared/grants";

/**
 * Engines with an adapter in tools/renderers, and the env var naming each install.
 *
 * ONLY ENGINES A USER CAN ACTUALLY HAVE. A RoleCall entry shipped here for a while and was wrong in
 * two ways: it could never resolve for anyone without that closed checkout, so the tool advertised a
 * capability it could not deliver, and its marker named an internal path of a closed codebase in a
 * public repository. An engine belongs here when somebody who downloaded Hoplight can point at a
 * real install of it.
 */
const ENGINES = {
  sillytavern: {
    root: "HOPLIGHT_ST_ROOT",
    command: "node",
    args: ["tools/renderers/sillytavern/render.mjs"],
    flag: "--st-root",
    /** A path that exists only inside a real install, so a wrong folder fails with a reason. */
    marker: join("public", "scripts", "macros", "macro-system.js"),
    install: "a SillyTavern checkout",
  },
  marinara: {
    root: "HOPLIGHT_MARINARA_ROOT",
    command: "bun",
    args: ["tools/renderers/marinara/render.ts"],
    flag: "--marinara-root",
    marker: join("packages", "shared", "src", "utils", "macro-engine.ts"),
    install: "a Marinara-Engine checkout",
  },
} as const;

const input = z.strictObject({
  engine: z.enum(["sillytavern", "marinara"])
    .describe("whose macro engine should assemble the preset"),
  preset: z.string().trim().min(1).max(400)
    .describe("path to the preset file, in that platform's own wire format"),
  state: z.record(z.string(), z.string()).optional()
    .describe("variables or choices to pre-set, in the engine's own naming"),
});

/** Where the engine lives, or null when nothing on this machine says. */
async function installRoot(engine: keyof typeof ENGINES): Promise<string | null> {
  const spec = ENGINES[engine];
  const root = process.env[spec.root];
  if (!root) return null;
  return (await Bun.file(join(root, spec.marker)).exists()) ? root : null;
}

const presetVerify: HarnessTool<z.infer<typeof input>> = {
  name: "preset_verify",
  description:
    "Assemble a preset through the target platform's real macro engine and report every macro that "
    + "did not resolve. Use this before claiming a preset or a conversion is finished: structural "
    + "checks cannot see a macro the engine will not expand.",
  exposure: "direct",
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
    const allowed = [grantFolder(ctx.bridge.studioDir, "studio"), ...(ctx.grants ?? [])];
    const check = await checkGrantReal(allowed, args.preset);
    if (!check.ok) {
      return { summary: `preset_verify: ${check.reason}`, output: check.detail };
    }
    if (!(await Bun.file(check.path).exists())) {
      return {
        summary: "preset_verify: preset not found",
        output: `No file at ${check.path}.`,
      };
    }

    // The engine comes last, because it is the only check whose answer depends on this machine rather
    // than on the request. Asking it first let an out-of-bounds path return "engine not available"
    // and never reach the boundary at all.
    const spec = ENGINES[args.engine];
    const root = await installRoot(args.engine);
    if (!root) {
      return {
        summary: `preset_verify ${args.engine}: engine not available`,
        output: `No ${args.engine} engine on this machine. Set ${spec.root} to ${spec.install} and `
          + "try again. Nothing was checked, so do not treat this as a pass.",
      };
    }

    const { runRenderer } = await import("../../core/preset/render/runner");
    const { unresolvedCount } = await import("../../core/preset/render/contract");
    const outcome = await runRenderer(
      { command: spec.command, args: [...spec.args, `${spec.flag}=${root}`] },
      // check.path, never args.preset. Validating one string and then using another is the gap that
      // makes a containment check decorative.
      { preset: check.path, ...(args.state ? { state: args.state } : {}) },
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
  },
};

export default presetVerify;
