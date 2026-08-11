#!/usr/bin/env node
/**
 * SillyTavern render adapter.
 *
 * Reads one RenderRequest as JSON on stdin, assembles the preset through SillyTavern's OWN macro
 * engine, and writes one reply on stdout matching src/core/preset/render/contract.ts. Nothing else
 * goes to stdout; diagnostics go to stderr, because the reply must be the only thing to parse.
 *
 * WHY A SEPARATE PROCESS. The engine expects the browser application around it and cannot be loaded
 * politely into a host that is doing something else. Out of process, a hang, a crash or a print loop
 * is the caller's to bound rather than the caller's to share.
 *
 * WHY THE USER'S OWN INSTALL, NOT A COPY IN THIS REPO. A vendored engine goes stale silently, and
 * stale is the failure mode that costs most here: the whole point of rendering is to catch a rule the
 * target will not run, and an old engine agrees with old mistakes. A copy already in this project's
 * orbit had drifted from the install beside it and changed its import convention in between. So the
 * engine is read from the SillyTavern the user actually runs, and the reply stamps its version.
 *
 * THE STAGING STEP EXISTS BECAUSE OF ONE DETAIL. Recent builds import their siblings with site-root
 * specifiers ("/scripts/utils.js") that mean the web root in a browser and the filesystem root
 * everywhere else. Nothing on disk can resolve them. So the macro folder is copied to a scratch
 * directory and every specifier LEAVING that folder is repointed at stub.mjs. The engine's own files
 * are untouched, and it has no npm imports of its own, so nothing else needs to resolve.
 */
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import {
  engineVersion,
  fail,
  HERE,
  installBrowserGlobals,
  resolveRoot,
  stageEngine,
} from "./stage.mjs";

const stRoot = resolveRoot();
const { entry, cleanup } = stageEngine(stRoot, "render");

// ---- request ------------------------------------------------------------------------------------
const raw = await (async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
})();

let request;
try {
  request = JSON.parse(raw || "{}");
} catch {
  fail("stdin was not a JSON RenderRequest");
}
if (typeof request.preset !== "string" || !existsSync(request.preset)) {
  fail(`preset not found: ${request.preset}`);
}

// ---- globals ------------------------------------------------------------------------------------

installBrowserGlobals();

// The variable store is the substance, not scaffolding: setvar writes here and getvar reads back.
const { installContext } = await import(pathToFileURL(join(HERE, "context.mjs")).href);
// Identity before the engine loads: {{char}} and {{user}} read the context, not the variable store,
// so a caller who means someone in particular has no other way to say so.
const vars = installContext(request.identity ?? {});
for (const [k, v] of Object.entries(request.state ?? {})) vars.local.set(k, v);

// ---- engine -------------------------------------------------------------------------------------

const engine = await import(entry).catch((e) => fail(`could not load the macro engine: ${e.message}`));
if (typeof engine.initRegisterMacros === "function") engine.initRegisterMacros();
const macros = engine.macros;
if (!macros?.engine?.evaluate || !macros?.envBuilder?.buildFromRawEnv) {
  fail("this SillyTavern build does not expose macros.engine.evaluate / macros.envBuilder");
}

// ---- assemble -----------------------------------------------------------------------------------

const preset = JSON.parse(readFileSync(request.preset, "utf8"));
const state = request.state ?? {};
const warnings = [];

/**
 * The two speakers, through the engine's OWN override fields.
 *
 * MacroEnvBuilder resolves `{{user}}`/`{{char}}` as `ctx.name1Override ?? name1`, where name1 is
 * imported from script.js - a module outside the macro folder, so staging redirects it to the stub
 * and it is fixed at "User"/"Character" for anyone who does not override. Editing the stub would
 * have worked and been wrong: the override is the path this engine documents for exactly this, and
 * a caller who names nobody still lands on the stub's defaults.
 */
const named = request.identity ?? {};
const overrides = {
  ...(typeof named.user === "string" && named.user ? { name1Override: named.user } : {}),
  ...(typeof named.char === "string" && named.char ? { name2Override: named.char } : {}),
};

/**
 * Only prompts named in prompt_order and enabled are assembled, because that is the surface
 * SillyTavern itself builds a turn from. Reporting macros from a block it would never send would be
 * a finding about text nobody sees.
 */
const byId = new Map((preset.prompts ?? []).map((p) => [p.identifier, p]));
const ordered = (preset.prompt_order ?? []).flatMap((g) => g.order ?? []);
if (ordered.length === 0) warnings.push("preset carries no prompt_order, so nothing was assembled");

const parts = [];
for (const entryRef of ordered) {
  if (!entryRef?.enabled) continue;
  const block = byId.get(entryRef.identifier);
  if (!block) {
    warnings.push(`prompt_order names "${entryRef.identifier}", which no prompt defines`);
    continue;
  }
  const content = typeof block.content === "string" ? block.content : "";
  if (!content.trim()) continue;
  try {
    const env = macros.envBuilder.buildFromRawEnv({ content, ...state, ...overrides });
    parts.push(macros.engine.evaluate(content, env));
  } catch (e) {
    warnings.push(`"${block.name ?? entryRef.identifier}" threw while evaluating: ${e.message}`);
  }
}
const prompt = parts.join("\n");

// ---- what survived ------------------------------------------------------------------------------

// Anything still wearing macro braces after the engine finished is unresolved by definition.
// Counted per distinct token so a receipt can name them rather than report one opaque total.
const seen = new Map();
for (const m of prompt.matchAll(/\{\{[^{}]{0,200}\}\}/g)) seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);

process.stdout.write(JSON.stringify({
  prompt,
  unresolved: [...seen].map(([token, count]) => ({ token, count })),
  warnings,
  engine: { name: "sillytavern", version: engineVersion(stRoot), source: stRoot },
}));
cleanup();
