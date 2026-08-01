#!/usr/bin/env bun
/**
 * Marinara render adapter.
 *
 * Reads one RenderRequest as JSON on stdin, resolves the preset's sections through Marinara's OWN
 * macro engine, and writes one reply on stdout matching src/core/preset/render/contract.ts.
 *
 * This one is short, and the reason is worth recording next to the SillyTavern adapter rather than
 * left as a happy accident. Marinara's `macro-engine.ts` imports NOTHING: no application modules, no
 * npm packages, no browser globals. It is one file with one entry point, so it can simply be
 * imported and called. SillyTavern's needs its whole browser application stubbed, staged and
 * rewritten before it will load at all.
 *
 * That difference is a property of the two codebases, not of how much care went into each adapter.
 * The contract is what makes them interchangeable to a caller regardless.
 *
 * Run under Bun, which loads the engine's TypeScript directly. Compiling a copy would put a build
 * artifact between the check and the thing being checked, and a stale one would agree with stale
 * mistakes - the failure this whole feature exists to catch.
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

const root = resolve(arg("marinara-root") ?? process.env.HOPLIGHT_MARINARA_ROOT ?? "");
if (!root || !existsSync(root)) {
  fail("no Marinara checkout declared; set HOPLIGHT_MARINARA_ROOT or pass --marinara-root=<path>");
}
const enginePath = join(root, "packages", "shared", "src", "utils", "macro-engine.ts");
if (!existsSync(enginePath)) fail(`not a Marinara checkout: ${enginePath} is missing`);

/** The engine's own version, from the checkout it was read out of. The contract refuses a reply without one. */
function engineVersion(): string {
  for (const p of [join(root, "package.json"), join(root, "packages", "shared", "package.json")]) {
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

// ---- engine -------------------------------------------------------------------------------------

const engine = await import(enginePath).catch((e: Error) =>
  fail(`could not load Marinara's macro engine: ${e.message}`));
const resolveMacros = (engine as { resolveMacros?: unknown }).resolveMacros;
if (typeof resolveMacros !== "function") {
  fail("this Marinara checkout does not export resolveMacros");
}

// ---- assemble -----------------------------------------------------------------------------------

const preset = JSON.parse(readFileSync(request!.preset as string, "utf8"));
const warnings: string[] = [];

/**
 * Marinara keeps its blocks in `data.sections`, each with its own `enabled` flag; there is no
 * separate order list, so document order IS the order. Disabled sections are skipped because the
 * platform does not send them, and reporting macros from text nobody sees would be a finding about
 * nothing.
 */
const sections = (preset?.data?.sections ?? preset?.sections ?? []) as {
  identifier?: string; name?: string; content?: string; enabled?: unknown;
}[];
if (!Array.isArray(sections) || sections.length === 0) {
  warnings.push("preset carries no sections, so nothing was assembled");
}

const ctx = {
  user: "User",
  char: "Character",
  characters: ["Character"],
  // The state the caller asked for. Marinara's engine reads variables straight off the context, so
  // this is the whole of what {{getvar}}-style macros will see.
  variables: { ...(request!.state ?? {}) },
  characterFields: {},
  characterProfiles: [],
};

const parts: string[] = [];
for (const section of sections) {
  if (section?.enabled === false || section?.enabled === 0) continue;
  const content = typeof section?.content === "string" ? section.content : "";
  if (!content.trim()) continue;
  try {
    parts.push((resolveMacros as (t: string, c: unknown) => string)(content, ctx));
  } catch (e) {
    warnings.push(`"${section.name ?? section.identifier ?? "?"}" threw while resolving: ${(e as Error).message}`);
  }
}
const prompt = parts.join("\n");

// ---- what survived ------------------------------------------------------------------------------

const seen = new Map<string, number>();
for (const m of prompt.matchAll(/\{\{[^{}]{0,200}\}\}/g)) seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);

process.stdout.write(JSON.stringify({
  prompt,
  unresolved: [...seen].map(([token, count]) => ({ token, count })),
  warnings,
  engine: { name: "marinara", version: engineVersion(), source: root },
}));
