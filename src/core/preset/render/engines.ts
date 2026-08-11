/**
 * Which engines Hoplight can actually drive, and where each one lives on this machine.
 *
 * ONE LIST, BECAUSE TWO CALLERS ASK THE SAME QUESTION. This table began inside preset_verify, where
 * it was the only reader. The Macro Lab asks the same thing from the browser side - is there an
 * engine here, what do I spawn, what do I tell someone who has none - and a second copy of it would
 * be two answers to "is SillyTavern available", drifting the first time either is edited.
 *
 * ONLY ENGINES A USER CAN ACTUALLY HAVE. A RoleCall entry shipped here for a while and was wrong in
 * two ways: it could never resolve for anyone without that closed checkout, so callers advertised a
 * capability they could not deliver, and its marker named an internal path of a closed codebase in a
 * public repository. An engine belongs here when somebody who downloaded Hoplight can point at a
 * real install of it.
 *
 * The catalogs in ../macros model five dialects; this models two RUNTIMES. They are different axes
 * and must not be collapsed into one picker: a lens can describe what Lumiverse means by a macro
 * without anything here being able to run it.
 */
import { join } from "node:path";
import type { RendererCommand } from "./runner";

export const RENDER_ENGINE_IDS = ["sillytavern", "marinara"] as const;
export type RenderEngineId = (typeof RENDER_ENGINE_IDS)[number];

export interface EngineSpec {
  /** how a person refers to it on screen */
  readonly label: string;
  /** the env var naming this install */
  readonly rootVar: string;
  readonly command: string;
  readonly args: readonly string[];
  /** the flag the adapter reads the root from, when the env var is not how it was told */
  readonly flag: string;
  /** A path that exists only inside a real install, so a wrong folder fails with a reason. */
  readonly marker: string;
  /** named in the refusal, so "not available" carries its own remedy */
  readonly install: string;
}

export const RENDER_ENGINES: Record<RenderEngineId, EngineSpec> = {
  sillytavern: {
    label: "SillyTavern",
    rootVar: "HOPLIGHT_ST_ROOT",
    command: "node",
    args: ["tools/renderers/sillytavern/render.mjs"],
    flag: "--st-root",
    marker: join("public", "scripts", "macros", "macro-system.js"),
    install: "a SillyTavern checkout",
  },
  marinara: {
    label: "Marinara",
    rootVar: "HOPLIGHT_MARINARA_ROOT",
    command: "bun",
    args: ["tools/renderers/marinara/render.ts"],
    flag: "--marinara-root",
    marker: join("packages", "shared", "src", "utils", "macro-engine.ts"),
    install: "a Marinara-Engine checkout",
  },
};

export const isRenderEngineId = (v: unknown): v is RenderEngineId =>
  typeof v === "string" && (RENDER_ENGINE_IDS as readonly string[]).includes(v);

/** Where the engine lives, or null when nothing on this machine says. */
export async function installRoot(engine: RenderEngineId): Promise<string | null> {
  const spec = RENDER_ENGINES[engine];
  const root = process.env[spec.rootVar];
  if (!root) return null;
  return (await Bun.file(join(root, spec.marker)).exists()) ? root : null;
}

/** How to spawn this engine's adapter against the install at `root`. */
export function rendererCommand(engine: RenderEngineId, root: string): RendererCommand {
  const spec = RENDER_ENGINES[engine];
  return { command: spec.command, args: [...spec.args, `${spec.flag}=${root}`] };
}

/** Every engine present on this machine, with the root each was found at. */
export async function availableEngines(): Promise<
  { id: RenderEngineId; label: string; root: string }[]
> {
  const found: { id: RenderEngineId; label: string; root: string }[] = [];
  for (const id of RENDER_ENGINE_IDS) {
    const root = await installRoot(id);
    if (root) found.push({ id, label: RENDER_ENGINES[id].label, root });
  }
  return found;
}
