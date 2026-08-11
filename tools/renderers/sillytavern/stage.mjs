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
 * RUN-ONCE, NEVER A BUILD STEP. This writes into the user's real checkout while it works, removes
 * the copy when it finishes, and sweeps any directory an earlier run was killed before removing.
 * That is acceptable for a tool a person invokes; it is not acceptable on a timer.
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
 * Leaf module names to resolve for real instead of stubbing. EMPTY, and deliberately so.
 *
 * The seam exists because `lib.js` - SillyTavern's bundled library barrel - was expected to need
 * real resolution, on the theory that the macro parser is built on packages it re-exports. It turned
 * out not to, because stub.mjs imports the four packages the engine actually needs - chevrotain,
 * moment, seedrandom, droll - directly rather than through the barrel. chevrotain is load-bearing
 * for parsing; the barrel is not. Do not read this as "nothing outside the folder is needed". Kept as a named seam rather than deleted, because the next build
 * that genuinely needs one should have somewhere obvious to put it.
 */
const RESOLVE_FOR_REAL = new Set();

/**
 * Remove staging directories left by runs that are no longer alive.
 *
 * A BELT FOR THE SIGNAL HANDLERS, because they cannot cover a SIGKILL or a power cut, and because
 * this install may already carry leftovers from before those handlers existed. Nothing else in this
 * repo ever reclaimed one.
 *
 * LIVENESS-CHECKED, NOT AGE-CHECKED. preset_verify and the Macro Lab can both be staging at the
 * same moment, so deleting by name or by mtime would delete a directory another process is loading
 * out of. `process.kill(pid, 0)` throws only when no such process exists; a live PID is left alone,
 * and so is our own. PID reuse can make this skip a genuinely dead directory, which is a leftover
 * rather than a broken run - the safe way to be wrong.
 */
export function sweepStale(scriptsDir) {
  let entries = [];
  try {
    entries = readdirSync(scriptsDir);
  } catch {
    return; // not a checkout we can read; staging will fail with its own message
  }
  for (const name of entries) {
    const pid = /^\.hoplight-[a-z]+-(\d+)$/.exec(name)?.[1];
    if (!pid || Number(pid) === process.pid) continue;
    try {
      process.kill(Number(pid), 0);
      continue; // still running: not ours to remove
    } catch (e) {
      // ESRCH means no such process, so the directory is abandoned. EPERM means the process EXISTS
      // and belongs to somebody else - a live run in a shared checkout - and deleting its staging
      // out from under it would break a render rather than tidy after one. Only ESRCH sweeps.
      if (e?.code !== "ESRCH") continue;
    }
    try { rmSync(join(scriptsDir, name), { recursive: true, force: true }); } catch { /* leave it */ }
  }
}

/**
 * Copy the macro folder into the install, repoint the specifiers that cannot resolve, and hand back
 * the staged entry point. The caller must call the returned cleanup.
 *
 * The scratch copy lives INSIDE the install, one folder over from the real macros, and the position
 * is load-bearing rather than lazy: relative imports between the engine's own files must land where
 * they would have, so the copy has to sit at the SAME depth as the original. One folder up or down
 * and every one of them resolves somewhere else.
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

  /**
   * TWO MECHANISMS, BECAUSE ONE OF THEM CANNOT WORK ON WINDOWS.
   *
   * `process.on("exit")` alone was a leak. Killing is the NORMAL end of this process, not an edge
   * case: runner.ts calls child.kill() on every timeout, and the budgets are real - 45s for a
   * scratch render, 180s for preset_verify - plus the host quitting Hoplight mid-render. What
   * survived was not a stray temp folder but a full copy of SillyTavern's macro tree, with
   * rewritten imports, inside somebody else's real install under public/scripts/.
   *
   * The signal handlers below catch a polite SIGTERM/SIGINT. They do NOT catch what Bun's
   * child.kill() does on Windows, which is a hard terminate no handler can intercept - measured,
   * not assumed: a killed render still leaves its directory on this platform. That is what
   * sweepStale is for, and why the sweep runs at stage time on every run rather than only here.
   *
   * Together the residue is bounded to at most one abandoned directory, reclaimed by the next
   * render, instead of one per incident forever.
   *
   * Re-raised rather than swallowed so the process still dies of the signal it was sent. On Windows
   * there are no real signals and process.kill terminates with exit 1 regardless, which is the
   * platform's answer rather than this code's.
   */
  // ONCE, not on: a re-raised signal re-enters a still-installed handler, which on POSIX is an
  // infinite loop where Ctrl+C never exits.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    process.once(signal, () => {
      cleanup();
      process.kill(process.pid, signal);
    });
  }
  process.on("exit", cleanup);
  // An uncaught throw exits without `exit` in some hosts, and this must not depend on which.
  process.on("uncaughtException", (e) => {
    cleanup();
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exit(1);
  });

  sweepStale(join(stRoot, "public", "scripts"));

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
