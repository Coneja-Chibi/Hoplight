/**
 * Run a scrap of macro text through a platform's real engine and get the resolved text back.
 *
 * preset_verify already asks an engine "what did not resolve in this preset". This asks a smaller and
 * more immediate question - "what does THIS say" - and the difference matters for who is asking. A
 * conversion check is run once after an edit; someone learning a macro wants to type six characters
 * and see the answer, without owning a preset at all.
 *
 * THE TRICK IS THAT THERE IS NO TRICK. Both adapters read a preset file and assemble the enabled
 * blocks, so a one-block preset carrying the scratch text assembles to exactly that text, resolved.
 * Nothing about the engines needed widening for it, which is the strongest evidence the answer is
 * really theirs: the same code path a converted preset takes is the code path a scratch line takes.
 *
 * Split the way runner.ts and contract.ts are: `scratchWireFile` is pure and is where the two wire
 * shapes are written down, `resolveScratch` owns the temp file and the process.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderIdentity, RenderOutcome } from "./contract";
import { refuse } from "./contract";
import { rendererCommand, type RenderEngineId } from "./engines";
import { runRenderer } from "./runner";

/**
 * The identifier the scratch block is filed under.
 *
 * Named rather than generated, because SillyTavern only assembles blocks its `prompt_order` points
 * at: the id in the block and the id in the order must be the same string or the engine assembles
 * nothing and reports a clean render of an empty prompt - a false pass, which is the one answer this
 * whole surface must never produce.
 */
const SCRATCH_ID = "hoplight_scratch";

/**
 * The scratch text as a one-block preset in the engine's own wire format.
 *
 * Pure and exported so the shapes are testable without an engine present. They are deliberately
 * minimal: everything a real preset carries that is not a prompt block is scaffolding these adapters
 * never read, and inventing plausible-looking extras would be inventing a preset rather than
 * carrying a line of text.
 */
export function scratchWireFile(engine: RenderEngineId, text: string): string {
  if (engine === "marinara") {
    // Marinara keeps blocks in data.sections and has no separate order list; document order IS
    // the order, and `enabled` is what the adapter filters on.
    return JSON.stringify({
      data: {
        sections: [
          { identifier: SCRATCH_ID, name: "Scratch", enabled: true, content: text },
        ],
      },
    });
  }
  // SillyTavern: prompts are a pool, prompt_order is the assembly list, and `enabled` there is
  // load-bearing - the adapter skips any entry without it.
  return JSON.stringify({
    name: "hoplight-macro-lab",
    prompts: [
      { identifier: SCRATCH_ID, name: "Scratch", role: "system", content: text },
    ],
    prompt_order: [{ character_id: 100001, order: [{ identifier: SCRATCH_ID, enabled: true }] }],
  });
}

export interface ScratchRequest {
  readonly engine: RenderEngineId;
  /** the install this engine was found at (see engines.ts installRoot) */
  readonly root: string;
  readonly text: string;
  /** variables to pre-set, in the engine's own naming */
  readonly state?: Readonly<Record<string, string>>;
  /** who `{{user}}` and `{{char}}` are */
  readonly identity?: RenderIdentity;
  readonly timeoutMs?: number;
}

/**
 * A scratch render is interactive: somebody is watching a button.
 *
 * preset_verify allows three minutes because a real preset can be hundreds of blocks and its caller
 * is a model that can wait. One block cannot take that long, and a person staring at a spinner for
 * three minutes has been told nothing. Long enough for SillyTavern's staging copy on a cold disk,
 * short enough to fail while anyone still cares.
 */
const SCRATCH_TIMEOUT_MS = 45_000;

/** Resolve one scrap of text. Every failure is a value; nothing here throws at the caller. */
export async function resolveScratch(req: ScratchRequest): Promise<RenderOutcome> {
  let dir: string;
  try {
    dir = await mkdtemp(join(tmpdir(), "hoplight-macro-lab-"));
  } catch (e) {
    return refuse(
      "spawn-failed",
      `could not make a scratch folder: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const preset = join(dir, `scratch.${req.engine}.json`);
  try {
    await writeFile(preset, scratchWireFile(req.engine, req.text), "utf8");
    return await runRenderer(
      rendererCommand(req.engine, req.root),
      {
        preset,
        ...(req.state ? { state: req.state } : {}),
        ...(req.identity ? { identity: req.identity } : {}),
      },
      { timeoutMs: req.timeoutMs ?? SCRATCH_TIMEOUT_MS },
    );
  } catch (e) {
    return refuse(
      "spawn-failed",
      `could not write the scratch preset: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    // Scratch, and a lab that litters the temp folder on every press is its own bug.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
