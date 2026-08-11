/**
 * Load SillyTavern's macro engine out of a real install, without loading the browser app around it.
 *
 * ONE LOADER, TWO CALLERS. render.mjs assembles a preset through this engine; dump.mjs asks the same
 * engine's registry what macros it has. Both need the identical, fiddly staging, and a second copy of
 * it would drift the first time SillyTavern changes an import convention - which is a thing that has
 * already happened once here.
 *
 * WHY STAGING AT ALL. Recent builds import their siblings with site-root specifiers
 * ("/scripts/utils.js") that mean the web root in a browser and the filesystem root everywhere else.
 * Nothing on disk can resolve them. So the macro folder is copied to a scratch directory and every
 * specifier LEAVING that folder is repointed at stub.mjs. The engine's own files are untouched, and
 * it has no npm imports of its own, so nothing else needs to resolve.
 *
 * WHY THE USER'S OWN INSTALL. A vendored engine goes stale silently, and stale is the failure that
 * costs most: the whole point is to agree with the SillyTavern somebody actually runs. A copy already
 * in this project's orbit had drifted from the install beside it.
 *
 * RUN-ONCE, NEVER A BUILD STEP. This writes into the user's real checkout while it works and removes
 * the copy on exit. That is acceptable for a tool a person invokes; it is not acceptable on a timer.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync }
  from "node:fs";
import { join, relative, resolve, sep, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

/** Read the `--name=value` form both adapters take. */
export const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

export const fail = (msg) => {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
};

/** The install to read, checked for the one path that only exists inside a real checkout. */
export function resolveRoot() {
  const stRoot = resolve(arg("st-root") ?? process.env.HOPLIGHT_ST_ROOT ?? "");
  if (!stRoot || !existsSync(stRoot)) {
    fail("no SillyTavern install declared; set HOPLIGHT_ST_ROOT or pass --st-root=<path>");
  }
  if (!existsSync(join(stRoot, "public", "scripts", "macros", "macro-system.js"))) {
    fail(`not a SillyTavern checkout: ${join(stRoot, "public", "scripts", "macros", "macro-system.js")} is missing`);
  }
  return stRoot;
}

/** The engine's own version, from the install it was read out of. */
export function engineVersion(stRoot) {
  try {
    return JSON.parse(readFileSync(join(stRoot, "package.json"), "utf8")).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Siblings the engine genuinely needs, resolved for real rather than stubbed.
 *
 * `lib.js` is SillyTavern's bundled library barrel: the macro parser is built on the packages it
 * re-exports, so a stub here yields an engine that loads and cannot parse. Everything else outside
 * the macro folder is the browser application, which is exactly what must not load.
 */
const RESOLVE_FOR_REAL = new Set();

/**
 * Copy the macro folder into the install, repoint the specifiers that cannot resolve, and hand back
 * the staged entry point. The caller must call the returned cleanup.
 *
 * The scratch copy lives INSIDE the install, one folder over from the real macros, and the position
 * is load-bearing rather than lazy: `lib.js` must resolve for real, which means the copy must sit at
 * the SAME depth as the original or every relative path lands somewhere else. Same depth, same
 * resolution, and the npm packages `lib.js` pulls in are found through the install's own
 * node_modules.
 */
export function stageEngine(stRoot, tag = "stage") {
  const macrosDir = join(stRoot, "public", "scripts", "macros");
  const stagedMacros = join(stRoot, "public", "scripts", `.hoplight-${tag}-${process.pid}`);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { rmSync(stagedMacros, { recursive: true, force: true }); } catch { /* scratch */ }
  };
  process.on("exit", cleanup);

  try {
    cpSync(macrosDir, stagedMacros, { recursive: true });
    cpSync(join(HERE, "stub.mjs"), join(stagedMacros, "stub.mjs"));
  } catch (e) {
    fail(`could not stage the engine inside ${stRoot}: ${e.message}`);
  }

  /**
   * Every name the engine destructures out of a redirected module.
   *
   * Collected rather than listed, because ES module named imports are checked at link time: a symbol
   * the stub does not export is a hard failure naming one symbol, and the set changes between
   * SillyTavern releases. Deriving it from the staged source means the stub always answers for
   * exactly what this install asks for.
   */
  const wanted = new Set();

  /** `import D, { a, b as c } from "x"` -> D, a, b. The local alias is irrelevant; the export name is not. */
  const collectNames = (statement) => {
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
  };

  /** Rewrite the specifiers that cannot or must not resolve, and only those. */
  const stageFile = (file) => {
    const src = readFileSync(file, "utf8");
    const depth = relative(stagedMacros, dirname(file)).split(sep).filter(Boolean).length;
    const toStub = `${depth === 0 ? "./" : "../".repeat(depth)}stub.mjs`;

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
  };

  /** Append an export for every collected name the template does not already answer for. */
  const completeStub = () => {
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
  };

  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".js")) stageFile(full);
    }
  })(stagedMacros);
  completeStub();

  return { stagedMacros, entry: pathToFileURL(join(stagedMacros, "macro-system.js")).href, cleanup };
}

/** The globals the engine reaches for during registration. Absent, it throws before a macro exists. */
export function installBrowserGlobals() {
  globalThis.window ??= globalThis;
  globalThis.document ??= {
    createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} }),
    head: { append() {} },
    body: { append() {} },
    createTreeWalker: () => ({ nextNode: () => null }),
  };
  globalThis.navigator ??= { userAgent: "hoplight-renderer" };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
}

export { HERE };
