#!/usr/bin/env bun
/**
 * RoleCall render adapter.
 *
 * Reads one RenderRequest as JSON on stdin, assembles the preset's prompts through RoleCall's OWN
 * macro processor, and writes one reply on stdout matching src/core/preset/render/contract.ts.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. RoleCall's reusable macro layer is `src/lib/macros`, and
 * this adapter runs it for real: the tokenizer, the registry, every handler, and `processTextBlocks`,
 * which carries a block's side effects forward so `{{setvar}}` in one prompt is visible to
 * `{{getvar}}` in a later one. That sequencing is the substance of a RoleCall preset and it is
 * genuinely exercised here.
 *
 * RoleCall's prompt ASSEMBLY is a different thing and is not run. `lib/ai/prompt-assembly.ts` is 4178
 * lines bound to Supabase, per-account gating, lorebook retrieval and chat state; it cannot execute
 * outside the application. So the selection rules below are REPRODUCED from `lib/ai/preset-loader.ts`
 * rather than called, and every one of them is cited to the line it came from. A finding from this
 * renderer is a finding about RoleCall's macro layer, not about a prompt the live application built.
 *
 * Run under Bun, from inside the RoleCall app, so its tsconfig `@/` alias and its node_modules
 * resolve the way they do for the app itself.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const fail = (msg: string): never => {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
};
const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const root = resolve(arg("rolecall-root") ?? process.env.HOPLIGHT_ROLECALL_ROOT ?? "");
if (!root || !existsSync(root)) {
  fail("no RoleCall checkout declared; set HOPLIGHT_ROLECALL_ROOT or pass --rolecall-root=<path>");
}
const macrosDir = join(root, "src", "lib", "macros");
if (!existsSync(join(macrosDir, "prompt-builder.ts"))) {
  fail(`not a RoleCall app: ${join(macrosDir, "prompt-builder.ts")} is missing`);
}

/** The app's own version, from the checkout it was read out of. The contract refuses a reply without one. */
function engineVersion(): string {
  for (const p of [join(root, "package.json"), join(root, "..", "..", "package.json")]) {
    try {
      const v = JSON.parse(readFileSync(p, "utf8")).version;
      if (typeof v === "string" && v) return v;
    } catch { /* try the next one */ }
  }
  return "unknown";
}

// ---- request ------------------------------------------------------------------------------------

const raw = await new Response(Bun.stdin.stream()).text();
let request: { preset?: unknown; state?: Record<string, string> };
try {
  request = JSON.parse(raw || "{}");
} catch {
  fail("stdin was not a JSON RenderRequest");
}
if (typeof request!.preset !== "string" || !existsSync(request!.preset)) {
  fail(`preset not found: ${String(request!.preset)}`);
}
const state = request!.state ?? {};

// ---- engine -------------------------------------------------------------------------------------

/**
 * RoleCall's registry narrates its own startup on stdout (alias collisions, prompt counts), and the
 * loader logs per assembly. stdout belongs to the reply, so those go to stderr for the rest of this
 * process. Reading the reply off the last line instead would work until the day the engine logs one
 * line AFTER finishing, and that failure would look like a malformed renderer rather than noise.
 */
for (const level of ["log", "info", "debug", "warn"] as const) {
  console[level] = (...parts: unknown[]) => process.stderr.write(`${parts.join(" ")}\n`);
}

const builder = await import(join(macrosDir, "prompt-builder.ts")).catch((e: Error) =>
  fail(`could not load RoleCall's prompt builder: ${e.message}`));
const choices = await import(join(macrosDir, "choice-groups.ts")).catch((e: Error) =>
  fail(`could not load RoleCall's choice groups: ${e.message}`));

const processTextBlocks = (builder as { processTextBlocks?: unknown }).processTextBlocks;
if (typeof processTextBlocks !== "function") {
  fail("this RoleCall checkout does not export processTextBlocks");
}

// ---- selection ----------------------------------------------------------------------------------

const preset = JSON.parse(readFileSync(request!.preset as string, "utf8"));
const warnings: string[] = [];

interface Prompt {
  identifier: string;
  name?: string;
  content?: string;
  enabled?: unknown;
  marker?: unknown;
}
const prompts: Prompt[] = Array.isArray(preset?.prompts) ? preset.prompts : [];
if (prompts.length === 0) warnings.push("preset carries no prompts, so nothing was assembled");

/**
 * Order is DOCUMENT ORDER, and the `prompt_order` array is deliberately ignored.
 *
 * That looks wrong against SillyTavern habit, so it is worth stating plainly: on import, RoleCall
 * numbers prompts by their position in this array (`app/api/presets/route.ts`, `sort_order:
 * promptOrder++`), and the loader reads them back with `.order("sort_order", { ascending: true })`
 * (`lib/ai/preset-loader.ts:318`). `prompt_order` is stored in a separate table that only the
 * import, export and publish paths ever read. Honouring it here would order the prompt differently
 * from the application and every finding would be about a file RoleCall never builds.
 */
const ordered = prompts.map((p, i) => ({ ...p, identifier: p.identifier ?? `unnamed-${i}` }));

/**
 * Enabled state, in the loader's own order of authority (preset-loader.ts:417-447):
 * the prompt's own flag first, then choice-group gating on top of it.
 *
 * Choice groups sit behind an account flag in the application. They are applied here because a
 * preset that declares them is authored around them, and rendering the prompts a selection excludes
 * would report macros from text the reader never sees.
 */
const groups = (choices as { parseChoiceGroups: (r: unknown) => unknown[] })
  .parseChoiceGroups(preset?.choice_groups ?? preset?.macro_engine_yaml);

/**
 * `state` carries choice selections where a key names a declared group, and local variables
 * otherwise. The contract calls this field "the engine's own naming, passed through untouched", and
 * in RoleCall a group id IS the name of a piece of state a reader sets.
 */
const byId = new Map((groups as { id: string; type: string }[]).map((g) => [g.id, g]));
const savedChoices: Record<string, unknown> = {};
const localVars = new Map<string, { value: unknown; createdAt: Date; updatedAt: Date }>();
for (const [key, value] of Object.entries(state)) {
  const group = byId.get(key);
  if (!group) {
    localVars.set(key, { value, createdAt: new Date(0), updatedAt: new Date(0) });
    continue;
  }
  /**
   * A selection has to arrive in the type its group is declared as, or RoleCall discards it and
   * silently falls back to the default. `state` is string-typed by the contract, so a toggle set to
   * "true" would be dropped and the render would report the default state while looking like it had
   * honoured the request. Coerced here rather than left to fail quietly.
   */
  if (group.type === "toggle") savedChoices[key] = value === "true";
  else if (group.type === "select_many") {
    savedChoices[key] = value.split(",").map((v) => v.trim()).filter(Boolean);
  } else savedChoices[key] = value;
}

const selections = (choices as { resolveSelections: (g: unknown, s: unknown) => unknown })
  .resolveSelections(groups, savedChoices);

const gated = (choices as {
  applyChoicePromptEnabledStates: (p: unknown, g: unknown, s: unknown) => { identifier: string; enabled: boolean }[];
}).applyChoicePromptEnabledStates(
  ordered.map((p) => ({ ...p, enabled: p.enabled !== false })),
  groups,
  selections,
);

/**
 * The loader's final filter (preset-loader.ts:483): enabled, and either carrying content or being a
 * structural marker. Markers are kept out of the assembled text because the application fills them
 * from chat state this renderer does not have, and inventing that state would make a preset look
 * resolved on evidence nobody supplied. They are counted and reported instead.
 */
const markers: string[] = [];
const blocks: { key: string; text: string }[] = [];
for (const prompt of gated) {
  if (!prompt.enabled) continue;
  const source = ordered.find((p) => p.identifier === prompt.identifier);
  const content = typeof source?.content === "string" ? source.content : "";
  if (!content.trim()) {
    if (source?.marker) markers.push(prompt.identifier);
    continue;
  }
  blocks.push({ key: prompt.identifier, text: content });
}
if (markers.length > 0) {
  warnings.push(`${markers.length} marker slot(s) left for the application to fill: ${markers.join(", ")}`);
}

// ---- assemble -----------------------------------------------------------------------------------

/**
 * A card and persona thin enough to be honest. Every field the caller did not supply stays empty, so
 * a macro reading one resolves to nothing rather than to an invented value that would hide a preset
 * depending on a card it never declares.
 */
const ctx = {
  character: { name: "Character" },
  persona: { name: "User" },
  messages: [],
  localVariables: localVars,
  globalVariables: new Map(),
  preset: { name: typeof preset?.name === "string" ? preset.name : "preset" },
};

let results: Map<string, { processedText: string; errors: { message?: string }[] }>;
try {
  results = (processTextBlocks as (b: unknown, c: unknown) => typeof results)(blocks, ctx);
} catch (e) {
  fail(`RoleCall's processor threw while assembling: ${(e as Error).message}`);
}

const parts: string[] = [];
for (const block of blocks) {
  const result = results!.get(block.key);
  if (!result) continue;
  parts.push(result.processedText);
  for (const error of result.errors ?? []) {
    warnings.push(`"${block.key}": ${error.message ?? String(error)}`);
  }
}
const prompt = parts.join("\n");

// ---- what survived ------------------------------------------------------------------------------

/**
 * Two tokens survive on purpose and must NOT be reported as unresolved.
 *
 * `{{message_history}}` and `{{lore}}` are filled by the application's assembly, not by the macro
 * layer: neither is a registered macro (nothing in `lib/macros/handlers` claims either name), and
 * both are substituted in `lib/ai/prompt-assembly.ts` from chat and lorebook state. Since this
 * renderer deliberately does not run that assembly, calling them unresolved would report a defect in
 * a preset that works, which is worse than reporting nothing. They are named in warnings instead, so
 * a reader can see they were recognised rather than missed.
 *
 * Every other name here IS a registered macro, so anything else surviving is a real finding.
 */
const ASSEMBLY_OWNED = new Set(["message_history", "lore"]);
const nameOf = (token: string): string =>
  token.slice(2, -2).trim().split("::")[0]!.trim().toLowerCase();

const seen = new Map<string, number>();
const deferred = new Map<string, number>();
for (const m of prompt.matchAll(/\{\{[^{}]{0,200}\}\}/g)) {
  const bucket = ASSEMBLY_OWNED.has(nameOf(m[0])) ? deferred : seen;
  bucket.set(m[0], (bucket.get(m[0]) ?? 0) + 1);
}
for (const [token, count] of deferred) {
  warnings.push(`${count}x ${token} left standing: the application's assembly fills it, and this renderer runs only the macro layer`);
}

process.stdout.write(JSON.stringify({
  prompt,
  unresolved: [...seen].map(([token, count]) => ({ token, count })),
  warnings,
  engine: { name: "rolecall", version: engineVersion(), source: root },
}));
