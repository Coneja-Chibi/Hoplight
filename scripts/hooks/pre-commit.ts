/** Fast pre-commit orchestration: structural guards plus only relevant catalog and lint work. */
import { needsComponentCatalog, needsDocsIndex, parseNameStatusZ, stagedUiTsx } from "./pre-commit-core";

const run = (name: string, command: string[]): number => {
  const result = Bun.spawnSync(command, { stdout: "inherit", stderr: "inherit" });
  const code = result.exitCode ?? 1;
  if (code !== 0) console.error(`GUARDRAIL BLOCK (${name}): command exited ${code}.`);
  return code;
};

/** True when the working tree differs from the staged snapshot (unstaged edits or untracked,
 *  non-ignored files) that a working-tree read would wrongly fold into generated output. */
function worktreeDivergesFromIndex(): boolean {
  const r = Bun.spawnSync(["git", "status", "--porcelain", "--untracked-files=all"], {
    stdout: "pipe",
    stderr: "inherit",
  });
  if ((r.exitCode ?? 1) !== 0) return true; // unknown state: take the safe (stash) path
  return new TextDecoder().decode(r.stdout).split("\n").some((line) => {
    if (!line) return false;
    if (line.startsWith("??")) return true; // untracked, non-ignored
    return line[1] !== undefined && line[1] !== " "; // unstaged worktree change (status column 2)
  });
}

/**
 * Regenerate the docs index from the STAGED snapshot and stage it. A pre-commit generator must not
 * read the raw working tree: if a developer stages one doc while leaving an edit to another unstaged,
 * a working-tree read folds the unstaged edit into the committed index, so docs:index:check goes
 * stale in CI right after the commit. When the tree diverges from the index we stash everything not
 * staged (keeping the staged snapshot in the tree, --keep-index), generate, stage the outputs, then
 * restore; when it does not diverge the tree already equals the staged snapshot and we generate
 * directly.
 */
function regenDocsIndexFromStagedSnapshot(): number {
  const stashed = worktreeDivergesFromIndex();
  if (stashed) {
    const push = Bun.spawnSync(
      ["git", "stash", "push", "--keep-index", "--include-untracked", "--quiet", "-m", "pre-commit-docs-index"],
      { stdout: "inherit", stderr: "inherit" },
    );
    if ((push.exitCode ?? 1) !== 0) {
      console.error("GUARDRAIL BLOCK (docs-index-stash): could not isolate the staged snapshot.");
      return 1;
    }
  }
  let code = run("docs-index-regen", ["bun", "run", "scripts/docs-index.ts"]);
  if (code === 0) {
    const add = Bun.spawnSync(["git", "add", "docs/generated/docs-index.json", "docs/llms.txt"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((add.exitCode ?? 1) !== 0) {
      console.error("GUARDRAIL BLOCK (docs-index-stage): could not stage the regenerated docs index.");
      code = 1;
    }
  }
  if (stashed) {
    const pop = Bun.spawnSync(["git", "stash", "pop", "--quiet"], { stdout: "inherit", stderr: "inherit" });
    if ((pop.exitCode ?? 1) !== 0) {
      console.error(
        "GUARDRAIL BLOCK (docs-index-restore): index regenerated, but your other changes could not be" +
          " restored automatically. They are safe in `git stash`; run `git stash pop` to recover them.",
      );
      return 1;
    }
  }
  return code;
}

function main(): number {
  const diff = Bun.spawnSync(
    ["git", "diff", "--cached", "--name-status", "-z", "--diff-filter=ACMRD"],
    { stdout: "pipe", stderr: "inherit" },
  );
  if ((diff.exitCode ?? 1) !== 0) {
    console.error("GUARDRAIL BLOCK (staged-paths): could not read the staged Git diff.");
    return diff.exitCode ?? 1;
  }
  const paths = parseNameStatusZ(new TextDecoder().decode(diff.stdout));

  // Auto-regenerate the docs index (from the staged snapshot) when docs change and stage it, so a
  // forgotten manual regen can never fail docs:index:check in verify:ci. A no-op when already current.
  if (needsDocsIndex(paths)) {
    const code = regenDocsIndexFromStagedSnapshot();
    if (code !== 0) return code;
  }

  const checks: Array<readonly [string, string[]]> = [
    ["structural", ["bun", "run", "scripts/hooks/gate.ts", "--staged"]],
    ["colors", ["bun", "run", "scripts/hooks/no-hardcode-colors.ts", "--staged"]],
  ];
  if (needsComponentCatalog(paths)) {
    checks.push(["component-catalog", ["bun", "run", "scripts/hooks/component-catalog.ts", "--check"]]);
  }
  const uiTsx = stagedUiTsx(paths);
  if (uiTsx.length > 0) checks.push(["ui-eslint", ["bunx", "eslint", ...uiTsx, "--max-warnings", "0"]]);
  for (const [name, command] of checks) {
    const code = run(name, command);
    if (code !== 0) return code;
  }
  return 0;
}

process.exit(main());
