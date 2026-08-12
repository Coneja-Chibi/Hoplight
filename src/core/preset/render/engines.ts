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

/** A folder somebody named for an engine, and how this machine came to know it. */
export type EngineRoots = Partial<Record<RenderEngineId, string>>;
export interface EngineRootFound {
  readonly root: string;
  /** "env" = a variable this process was launched with; "saved" = the folder set in Settings. */
  readonly from: "env" | "saved";
}

/**
 * The roots somebody SAVED, as this process currently understands them.
 *
 * Core cannot read the studio folder - that is the studio layer's job and this module is below it -
 * so the saved answer is handed down rather than fetched. src/studio/engine-roots.ts owns the file;
 * Kit applies it when a session is built and the settings route re-applies it on every save, so the
 * running process never has to be restarted to notice a folder somebody just pointed at.
 *
 * Module state, deliberately: `HarnessTool.available()` takes no arguments (tool.ts), so the belt
 * decides whether to offer preset_verify with nothing to inject. Tests must reset it - one leaked
 * root would make an "engine absent" case pass against a real checkout.
 */
let savedRoots: EngineRoots = {};

/** Hand core the saved roots. Called at Kit session build and after a settings write. */
export function applyEngineRoots(roots: EngineRoots): void {
  savedRoots = { ...roots };
}

/** What was last applied - for tests, and for a screen that reports what is in force. */
export const appliedEngineRoots = (): EngineRoots => ({ ...savedRoots });

/** Does this folder actually hold that engine? The marker is the whole of the evidence. */
export async function looksLikeInstall(engine: RenderEngineId, root: string): Promise<boolean> {
  if (!root) return false;
  return await Bun.file(join(root, RENDER_ENGINES[engine].marker)).exists();
}

/**
 * Where the engine lives, and who said so - or null when nothing on this machine does.
 *
 * THE VARIABLE OUTRANKS THE SAVED FOLDER, and not for neatness: the live render tests
 * (scratch.live.test.ts, runner.live.test.ts, the starter-settings and skeletons live suites) all
 * point the root vars at a checkout of their choosing. A saved setting that won would silently
 * redirect a harness that believes it named its own engine.
 *
 * A variable that is set but names no install resolves to NOTHING rather than falling through to the
 * saved folder. Falling through would quietly paper over a typo in the variable and leave somebody
 * reading output from an engine they did not choose.
 */
export async function resolveEngineRoot(
  engine: RenderEngineId,
  roots: EngineRoots = savedRoots,
): Promise<EngineRootFound | null> {
  const fromEnv = process.env[RENDER_ENGINES[engine].rootVar];
  if (fromEnv) {
    return (await looksLikeInstall(engine, fromEnv)) ? { root: fromEnv, from: "env" } : null;
  }
  const saved = roots[engine];
  if (!saved) return null;
  return (await looksLikeInstall(engine, saved)) ? { root: saved, from: "saved" } : null;
}

/** Where the engine lives, or null when nothing on this machine says. */
export async function installRoot(
  engine: RenderEngineId,
  roots?: EngineRoots,
): Promise<string | null> {
  return (await resolveEngineRoot(engine, roots))?.root ?? null;
}

/**
 * What to say when there is no engine here - in one place, because there are two mouths.
 *
 * The Macro Lab and preset_verify both refuse for the same reason, and both used to say only "set
 * HOPLIGHT_ST_ROOT". That was the whole of the interface: a variable, described in a refusal, that
 * a person had to know how to set before they could use the room. Settings now takes a folder, so
 * the remedy names the screen first and keeps the variable for whoever launched with one.
 */
export const noEngineHere = (engine: RenderEngineId): string => {
  const spec = RENDER_ENGINES[engine];
  return `No ${spec.label} engine on this machine. Open Settings > Studio and point it at `
    + `${spec.install}, or launch with ${spec.rootVar} set.`;
};

/** How to spawn this engine's adapter against the install at `root`. */
export function rendererCommand(engine: RenderEngineId, root: string): RendererCommand {
  const spec = RENDER_ENGINES[engine];
  return { command: spec.command, args: [...spec.args, `${spec.flag}=${root}`] };
}

/** Every engine present on this machine, with the root each was found at. */
export async function availableEngines(
  roots?: EngineRoots,
): Promise<{ id: RenderEngineId; label: string; root: string; from: "env" | "saved" }[]> {
  const found: { id: RenderEngineId; label: string; root: string; from: "env" | "saved" }[] = [];
  for (const id of RENDER_ENGINE_IDS) {
    const hit = await resolveEngineRoot(id, roots);
    if (hit) found.push({ id, label: RENDER_ENGINES[id].label, root: hit.root, from: hit.from });
  }
  return found;
}
