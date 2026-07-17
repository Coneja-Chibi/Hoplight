/**
 * The green + discipline gate: the imperative shell around lib.ts. Gathers the changed files (staged
 * for a commit, or the whole working tree for a "declaring done" check), runs the pure detectors, and
 * runs the test suite. Any violation exits 2 (the editor + git blocking contract); a clean pass
 * exits 0; an infrastructure failure (no git, unreadable file) exits 1 so a broken gate never locks
 * the repo - it fails closed on a real violation, open on its own breakage.
 *
 * Modes: --staged (git pre-commit, staged diff) | --worktree (editor Stop hook, uncommitted changes).
 * Run: bun run scripts/hooks/gate.ts --staged
 */
import { readFileSync, statSync } from "node:fs";
import { htmlSinkTokens, impureCoreTokens, isCoreFile, isLineGuardedFile, isTestFile, missingCoreSiblings, overLineCap, shellImportTokens } from "./lib";
import { countLines, loadCeilings } from "./file-lines";

const mode: "staged" | "worktree" = process.argv.includes("--staged") ? "staged" : "worktree";

const run = (cmd: string[]): { out: string; code: number } => {
  const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  return { out: new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr), code: r.exitCode ?? 1 };
};

/** Changed files for the active mode, normalized to forward slashes. */
function changedFiles(): string[] {
  if (mode === "staged") {
    return run(["git", "diff", "--cached", "--name-only"]).out.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  // worktree: porcelain lines are "XY path"; a rename shows "old -> new" (keep the new path)
  return run(["git", "status", "--porcelain"]).out
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim())
    .map((p) => (p.includes(" -> ") ? p.slice(p.indexOf(" -> ") + 4) : p))
    .map((p) => p.replace(/\\/g, "/"))
    .filter(Boolean);
}

const fileExists = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

function main(): number {
  let all: string[];
  try {
    all = changedFiles();
  } catch (err) {
    console.error(`gate: could not read git state, skipping (${String(err)})`);
    return 1; // infra failure -> non-blocking
  }

  const violations: string[] = [];

  // 0. size cap: no changed file may cross its ceiling (frozen godfiles) or the default cap. Runs on
  //    every guarded file (any extension), so a growing .tsx/.css is caught, not just .ts.
  const ceilings = loadCeilings();
  for (const p of all.filter(isLineGuardedFile)) {
    try {
      const v = overLineCap(p, countLines(p), ceilings);
      if (v) violations.push(v);
    } catch {
      /* deleted/unreadable: not this gate's problem */
    }
  }

  const changed = all.filter((p) => p.endsWith(".ts"));
  if (changed.length === 0) {
    // no TS touched: only the size cap could have fired
    if (violations.length) {
      console.error(`\nGUARDRAIL BLOCK (${mode})\n\n${violations.map((v) => `  - ${v}`).join("\n\n")}\n`);
      return 2;
    }
    return 0;
  }

  // 1. core purity: a *-core.ts may not reach for effects
  for (const p of changed.filter(isCoreFile).filter((x) => !isTestFile(x))) {
    try {
      const bad = impureCoreTokens(readFileSync(p, "utf8"));
      if (bad.length) {
        violations.push(`${p} is a *-core but reaches for effects (${bad.join(", ")}). Pure logic only; move effects to the shell.`);
      }
    } catch {
      /* file staged-then-deleted, or unreadable: not this gate's problem */
    }
  }

  // 2. core sibling: a changed *-core.ts must own a *-core.test.ts
  for (const missing of missingCoreSiblings(changed, fileExists)) {
    violations.push(`missing test ${missing}. A *-core owns a sibling *-core.test.ts (name it, you test it).`);
  }

  // 2b. html sinks: UI source never injects raw HTML (ADR-008; the auto-escape rule has no quiet exceptions)
  // 2c. shell imports: apps/setup reach the shell ONLY through ctx (a per-bundle module copy is a
  //     split-brain store/react - the class that black-screened the first React boot)
  for (const p of changed) {
    try {
      const source = readFileSync(p, "utf8");
      const sinks = htmlSinkTokens(p, source);
      if (sinks.length) {
        violations.push(`${p} uses a banned HTML-injection sink (${sinks.join(", ")}). Build nodes (textContent/DOMParser icon pattern) or JSX; see ADR-008.`);
      }
      const shellImports = shellImportTokens(p, source);
      if (shellImports.length) {
        violations.push(`${p} imports shell modules (${shellImports.join(", ")}). Apps use ctx only; a per-bundle copy forks the store/React.`);
      }
    } catch {
      /* deleted/unreadable: not this gate's problem */
    }
  }

  // 3. green gate: the supported suite must be green (fast; tsc lives on pre-push).
  // Single definition: package.json `test` (active roots only). Parked `src/macros` uses `test:macros`.
  const test = run(["bun", "run", "test"]);
  if (test.code !== 0) {
    violations.push(`bun run test is red. Fix it before ${mode === "staged" ? "committing" : "declaring done"}.\n${test.out.trim().split("\n").slice(-12).join("\n")}`);
  }

  if (violations.length) {
    console.error(`\nGUARDRAIL BLOCK (${mode})\n\n` + violations.map((v) => `  - ${v}`).join("\n\n") + "\n");
    return 2;
  }
  return 0;
}

process.exit(main());
