/**
 * The green + discipline gate: the imperative shell around lib.ts. Gathers the changed files (staged
 * for a commit, or the whole working tree for a "declaring done" check), runs the pure detectors, and
 * runs the test suite. Any violation exits 2 (the Claude Code + git blocking contract); a clean pass
 * exits 0; an infrastructure failure (no git, unreadable file) exits 1 so a broken gate never locks
 * the repo - it fails closed on a real violation, open on its own breakage.
 *
 * Modes: --staged (git pre-commit, staged diff) | --worktree (Claude Code Stop, uncommitted changes).
 * Run: bun run scripts/hooks/gate.ts --staged
 */
import { readFileSync, statSync } from "node:fs";
import { htmlSinkTokens, impureCoreTokens, isCoreFile, isTestFile, missingCoreSiblings } from "./lib";

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
  let changed: string[];
  try {
    changed = changedFiles().filter((p) => p.endsWith(".ts"));
  } catch (err) {
    console.error(`gate: could not read git state, skipping (${String(err)})`);
    return 1; // infra failure -> non-blocking
  }
  if (changed.length === 0) return 0; // no TS touched (e.g. a conversation-only turn): nothing to check

  const violations: string[] = [];

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
  for (const p of changed) {
    try {
      const sinks = htmlSinkTokens(p, readFileSync(p, "utf8"));
      if (sinks.length) {
        violations.push(`${p} uses a banned HTML-injection sink (${sinks.join(", ")}). Build nodes (textContent/DOMParser icon pattern) or JSX; see ADR-008.`);
      }
    } catch {
      /* deleted/unreadable: not this gate's problem */
    }
  }

  // 3. green gate: the suite must be green (fast; tsc lives on pre-push)
  const test = run(["bun", "test"]);
  if (test.code !== 0) {
    violations.push(`bun test is red. Fix it before ${mode === "staged" ? "committing" : "declaring done"}.\n${test.out.trim().split("\n").slice(-12).join("\n")}`);
  }

  if (violations.length) {
    console.error(`\nGUARDRAIL BLOCK (${mode})\n\n` + violations.map((v) => `  - ${v}`).join("\n\n") + "\n");
    return 2;
  }
  return 0;
}

process.exit(main());
