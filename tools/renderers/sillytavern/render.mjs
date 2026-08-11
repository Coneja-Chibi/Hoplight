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
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync }
  from "node:fs";
import { join, relative, resolve, sep, dirname } from "node:path";

import { pathToFileURL } from "node:url";

const fail = (msg) => {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
};
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const stRoot = resolve(arg("st-root") ?? process.env.HOPLIGHT_ST_ROOT ?? "");
if (!stRoot || !existsSync(stRoot)) {
  fail("no SillyTavern install declared; set HOPLIGHT_ST_ROOT or pass --st-root=<path>");
}
const macrosDir = join(stRoot, "public", "scripts", "macros");
if (!existsSync(join(macrosDir, "macro-system.js"))) {
  fail(`not a SillyTavern checkout: ${join(macrosDir, "macro-system.js")} is missing`);
}

/** The engine's own version, from the install it was read out of. The contract refuses a reply without one. */
function engineVersion() {
  try {
    return JSON.parse(readFileSync(join(stRoot, "package.json"), "utf8")).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

// ---- stage --------------------------------------------------------------------------------------

/**
 * The scratch copy lives INSIDE the install, one folder over from the real macros, and the position
 * is load-bearing rather than lazy.
 *
 * The engine's siblings are not all disposable. `lib.js` is the bundled library barrel that hands it
 * the actual parser it is built on, so stubbing that produces an engine with no parser. It has to
 * resolve for real, which means the copy must sit at the SAME depth as the original or every
 * relative path lands somewhere else. Same depth, same resolution, and the npm packages `lib.js`
 * pulls in are found through the install's own node_modules.
 *
 * Dot-prefixed and removed on exit. If the install is not writable this fails loudly rather than
 * quietly rendering against something else.
 */
const staging = join(stRoot, "public", "scripts", `.hoplight-render-${process.pid}`);
const stagedMacros = staging;
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  try { rmSync(staging, { recursive: true, force: true }); } catch { /* a scratch dir, not worth reporting */ }
};
process.on("exit", cleanup);

try {
  cpSync(macrosDir, stagedMacros, { recursive: true });
  cpSync(join(HERE, "stub.mjs"), join(stagedMacros, "stub.mjs"));
} catch (e) {
  fail(`could not stage the engine inside ${stRoot}: ${e.message}`);
}

const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\2/g;

/**
 * Siblings the engine genuinely needs, resolved for real rather than stubbed.
 *
 * `lib.js` is SillyTavern's bundled library barrel: the macro parser is built on the packages it
 * re-exports, so a stub here yields an engine that loads and cannot parse. Everything else outside
 * the macro folder is the browser application, which is exactly what must not load.
 */
const RESOLVE_FOR_REAL = new Set();

/**
 * Every name the engine destructures out of a redirected module.
 *
 * Collected rather than listed, because ES module named imports are checked at link time: a symbol
 * the stub does not export is a hard failure naming one symbol, and the set changes between
 * SillyTavern releases. A hand-written list would work until the next one and then fail on a name
 * nobody has heard of. Deriving it from the staged source means the stub always answers for exactly
 * what this install asks for.
 */
const wanted = new Set();

/** `import D, { a, b as c } from "x"` -> D, a, b. The local alias is irrelevant; the export name is not. */
function collectNames(statement) {
  const braces = /import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([^}]*)\}/.exec(statement);
  if (braces) {
    if (braces[1]) wanted.add("default");
    for (const part of braces[2].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) wanted.add(name);
    }
    return;
  }
  if (/import\s+[A-Za-z_$][\w$]*\s+from/.test(statement)) wanted.add("default");
}

/** Rewrite the specifiers that cannot or must not resolve, and only those. */
function stageFile(file) {
  const src = readFileSync(file, "utf8");
  const depth = relative(stagedMacros, dirname(file)).split(sep).filter(Boolean).length;
  const toStub = `${depth === 0 ? "./" : "../".repeat(depth)}stub.mjs`;

  // Statement-level first, so the names belonging to a redirected module can be collected.
  const out = src.replace(
    /import\s+(?:[^'"]*?\s+from\s*)?(['"])([^'"]+)\1/g,
    (whole, quote, spec) => {
      const leaf = spec.split("/").pop() ?? "";
      const redirect = RESOLVE_FOR_REAL.has(leaf)
        ? false
        : spec.startsWith("/")
          ? true
          : spec.startsWith(".")
            ? !(resolve(dirname(file), spec) === stagedMacros
              || resolve(dirname(file), spec).startsWith(stagedMacros + sep))
            : false;
      if (!redirect) return whole;
      collectNames(whole);
      return whole.replace(`${quote}${spec}${quote}`, `${quote}${toStub}${quote}`);
    },
  );
  if (out !== src) writeFileSync(file, out, "utf8");
}

/** Append an export for every collected name the template does not already answer for. */
function completeStub() {
  const stubPath = join(stagedMacros, "stub.mjs");
  const template = readFileSync(stubPath, "utf8");
  const already = new Set(
    [...template.matchAll(/export\s+(?:const|default)\s+([A-Za-z_$][\w$]*)?/g)]
      .map((m) => m[1] ?? "default"),
  );
  for (const m of template.matchAll(/\bas\s+([A-Za-z_$][\w$]*)\s*[,}]/g)) already.add(m[1]);

  const extra = [...wanted].filter((n) => n !== "default" && !already.has(n)).sort();
  if (extra.length === 0) return;
  writeFileSync(
    stubPath,
    `${template}\n// Derived from what this install's engine imports, at staging time.\n`
    + extra.map((n) => `export const ${n} = any;`).join("\n")
    + "\n",
    "utf8",
  );
}

(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith(".js")) stageFile(full);
  }
})(stagedMacros);
completeStub();

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

// The engine reaches for these during registration. Absent, it throws before a macro exists.
globalThis.window ??= globalThis;
globalThis.document ??= {
  createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} }),
  head: { append() {} },
  body: { append() {} },
  createTreeWalker: () => ({ nextNode: () => null }),
};
globalThis.navigator ??= { userAgent: "hoplight-renderer" };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

// The variable store is the substance, not scaffolding: setvar writes here and getvar reads back.
const { installContext } = await import(pathToFileURL(join(HERE, "context.mjs")).href);
// Identity before the engine loads: {{char}} and {{user}} read the context, not the variable store,
// so a caller who means someone in particular has no other way to say so.
const vars = installContext(request.identity ?? {});
for (const [k, v] of Object.entries(request.state ?? {})) vars.local.set(k, v);

// ---- engine -------------------------------------------------------------------------------------

const entry = pathToFileURL(join(stagedMacros, "macro-system.js")).href;
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
  engine: { name: "sillytavern", version: engineVersion(), source: stRoot },
}));
cleanup();
