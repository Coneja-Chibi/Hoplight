/**
 * No-hardcoded-colors guard - UI wears tokens, not raw hex/rgb/hsl. The imperative shell around
 * lib.ts's pure detector (hardcodedColorLiteral / isColorGuardedFile).
 *
 *   --staged : pre-commit. Blocks color literals ADDED in the staged diff of guarded UI files.
 *   --scan   : retroactive report of the whole tree (exit 0 even with hits).
 *   --check  : whole-tree blocking gate (exit 2 on any hit).
 *
 * Escape: same-line `hardcode-ok` comment with a reason.
 *
 * Run: bun run scripts/hooks/no-hardcode-colors.ts --scan|--check|--staged
 */
import { readFileSync } from "node:fs";
import { addedLinesByFile, hardcodedColorLiteral, isColorGuardedFile } from "./lib";

const mode: "staged" | "scan" | "check" = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--scan")
    ? "scan"
    : "staged";

interface Hit {
  file: string;
  line: number;
  literal: string;
  text: string;
}

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";

function reportAndExit(hits: Hit[], header: string, blocking: boolean): never {
  if (hits.length === 0) {
    console.log(`no-hardcode-colors: clean (${mode}).`);
    process.exit(0);
  }
  console.error(`\n${RED}${header}${RESET}`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${RED}${h.literal}${RESET}  ${DIM}${h.text}${RESET}`);
  }
  console.error(
    `\n${hits.length} hardcoded color${hits.length === 1 ? "" : "s"}. Use a token (var(--x)) from ` +
      `src/ui/theme/tokens.css, or mark a genuine one-off with a \`hardcode-ok\` comment.\n`,
  );
  process.exit(blocking ? 2 : 0);
}

if (mode === "staged") {
  const diff = new TextDecoder().decode(
    Bun.spawnSync(["git", "diff", "--cached"], { stdout: "pipe" }).stdout,
  );
  const hits: Hit[] = [];
  for (const [file, lines] of addedLinesByFile(diff)) {
    if (!isColorGuardedFile(file)) continue;
    for (const text of lines) {
      const literal = hardcodedColorLiteral(text);
      if (literal !== null) hits.push({ file, line: 0, literal, text: text.trim().slice(0, 80) });
    }
  }
  reportAndExit(hits, "Hardcoded colors added in this commit (UI must wear tokens):", true);
}

const glob = (pattern: string): string[] => Array.from(new Bun.Glob(pattern).scanSync("."));
const files = [...glob("src/ui/**/*.tsx"), ...glob("src/ui/**/*.module.css"), ...glob("src/ui/**/*.ts")]
  .filter(isColorGuardedFile)
  .sort();

const hits: Hit[] = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((text, i) => {
      const literal = hardcodedColorLiteral(text);
      if (literal !== null) hits.push({ file, line: i + 1, literal, text: text.trim().slice(0, 80) });
    });
}
reportAndExit(
  hits,
  mode === "check"
    ? `Color check failed: hardcoded colors in ${files.length} guarded UI files:`
    : `Retroactive scan: hardcoded colors in ${files.length} guarded UI files:`,
  mode === "check",
);
