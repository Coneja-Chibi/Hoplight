/** Fast pre-commit orchestration: structural guards plus only relevant catalog and lint work. */
import { needsComponentCatalog, needsDocsIndex, parseNameStatusZ, stagedUiTsx } from "./pre-commit-core";

const run = (name: string, command: string[]): number => {
  const result = Bun.spawnSync(command, { stdout: "inherit", stderr: "inherit" });
  const code = result.exitCode ?? 1;
  if (code !== 0) console.error(`GUARDRAIL BLOCK (${name}): command exited ${code}.`);
  return code;
};

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

  // Auto-regenerate the docs index when docs change and stage it, so a forgotten manual regen can
  // never fail docs:index:check in verify:ci (the recurring stale-index CI red). A no-op when the
  // index is already current.
  if (needsDocsIndex(paths)) {
    if (run("docs-index-regen", ["bun", "run", "scripts/docs-index.ts"]) !== 0) return 1;
    const add = Bun.spawnSync(["git", "add", "docs/generated/docs-index.json", "docs/llms.txt"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((add.exitCode ?? 1) !== 0) {
      console.error("GUARDRAIL BLOCK (docs-index-stage): could not stage the regenerated docs index.");
      return add.exitCode ?? 1;
    }
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
