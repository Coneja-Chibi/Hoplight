/**
 * The branch-test gate (git commit-msg hook). If this commit adds a new branch to the imperative
 * shell (boot.ts / an app index.ts) - the shape of the follow-dialog bug - it hard-blocks the commit
 * unless one of two things clears it: a test file is in the same commit, OR the message carries an
 * explicit "Verified: <how>" / "Tested: <how>" note. Blocking by default turns a silent skip into a
 * recorded, deliberate act. It cannot force honesty inside the note; it can force the note to exist.
 *
 * Run by git as: bun run scripts/hooks/branch-note.ts <path-to-commit-msg-file>
 */
import { readFileSync } from "node:fs";
import { addedDependencies, declaresDependency, hasVerifiedNote, isTestFile, shellBranchHits } from "./lib";

const run = (cmd: string[]): string => {
  const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  return new TextDecoder().decode(r.stdout);
};

function main(): number {
  const msgFile = process.argv[2];
  if (!msgFile) return 0;

  let message: string;
  let diff: string;
  let staged: string[];
  try {
    message = readFileSync(msgFile, "utf8");
    diff = run(["git", "diff", "--cached", "-U0"]);
    staged = run(["git", "diff", "--cached", "--name-only"]).split("\n").map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    console.error(`branch-note: could not read commit state, skipping (${String(err)})`);
    return 1; // infra failure -> non-blocking
  }

  // dependency ledger (ADR-008): every added package must be declared, with a reason, in the message
  const undeclared = addedDependencies(diff).filter((p) => !declaresDependency(message, p));
  if (undeclared.length) {
    console.error(
      "\nGUARDRAIL BLOCK (dependency)\n\n" +
        `  package.json adds: ${undeclared.join(", ")}\n\n` +
        "  Dependencies are attack surface. Declare each one in the commit message:\n" +
        "    New-Dependency: <name> (<why it earns its place>)\n",
    );
    return 2;
  }

  const hits = shellBranchHits(diff);
  if (hits.length === 0) return 0; // no new shell branch: nothing to prove

  if (staged.some(isTestFile) || hasVerifiedNote(message)) return 0; // cleared by a test or a note

  const lines = hits.slice(0, 5).map((h) => `      ${h.file}: ${h.line}`).join("\n");
  console.error(
    "\nGUARDRAIL BLOCK (branch-test)\n\n" +
      "  This commit adds branching to the imperative shell with no test touched:\n\n" +
      lines +
      (hits.length > 5 ? `\n      ... and ${hits.length - 5} more` : "") +
      "\n\n  Clear it one of two ways:\n" +
      "    - add or touch a test that exercises the new branch, OR\n" +
      "    - add a line to the commit message:  Verified: <how you checked it live>\n",
  );
  return 2;
}

process.exit(main());
