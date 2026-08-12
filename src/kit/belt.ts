/**
 * Which discovered tools this machine can actually offer.
 *
 * OFFER ONLY WHAT THIS MACHINE CAN RUN. A tool in the belt reads as a thing that works.
 * preset_verify needs a SillyTavern or Marinara checkout; on a machine with neither it was still
 * offered, and the model spent a step finding out - after several more spent guessing a file path.
 * One turn, nothing written.
 *
 * WHERE THE ENGINES ARE IS PART OF THE SAME QUESTION, which is why the saved folders are loaded
 * here rather than left to each caller. `available()` takes no arguments by design (it is asked
 * once, about the machine, not about a request), so the answer has to already be true by the time
 * it is asked. Without this, somebody who pointed the studio window at their SillyTavern checkout
 * would still be told the terminal has no engine - one setting, two programs, two answers.
 *
 * Asked once when the session is built: an install does not appear halfway through a conversation.
 */
import { loadEngineRoots } from "../studio/engine-roots";
import type { HarnessTool } from "./tools/tool";

export async function offerableTools(
  discovered: readonly HarnessTool<unknown>[],
  studioDir: string,
): Promise<HarnessTool<unknown>[]> {
  await loadEngineRoots(studioDir);
  const asked = await Promise.all(
    discovered.map(async (tool) => ({
      tool,
      ok: tool.available === undefined || (await tool.available()),
    })),
  );
  return asked.filter((entry) => entry.ok).map((entry) => entry.tool);
}
