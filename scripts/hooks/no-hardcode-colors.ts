/**
 * No-hardcoded-colors guard - UI wears tokens, not raw hex/rgb/hsl. The imperative shell around
 * lib.ts's pure detector (hardcodedColorLiteral / isColorGuardedFile). Two modes:
 *
 *   --staged : pre-commit. Blocks only the color literals ADDED in the staged diff of guarded UI
 *              files, so new hardcoding dies at the commit while the existing backlog does not wedge
 *              every commit. A violation exits 2 (the git/Claude-Code blocking contract).
 *   --scan   : retroactive audit. Walks every guarded UI file and reports each hardcoded color plus a
 *              total. Exit 0 - a report, not a gate; the backlog is migrated to tokens deliberately.
 *
 * The one legal escape is a `hardcode-ok` comment on the line (a brand-color datum, a documented
 * one-off); token definitions and the color-math/brand-data files are allowlisted in lib.ts.
 *
 * Run: bun run scripts/hooks/no-hardcode-colors.ts --scan
 */
import { readFileSync } from "node:fs";
import { addedLinesByFile, hardcodedColorLiteral, isColorGuardedFile } from "./lib";

const mode: "staged" | "scan" = process.argv.includes("--scan") ? "scan" : "staged";

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

// --scan: the whole tree
const glob = (pattern: string): string[] => Array.from(new Bun.Glob(pattern).scanSync("."));
const files = [...glob("src/ui/**/*.tsx"), ...glob("src/ui/**/*.module.css")]
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
reportAndExit(hits, `Retroactive scan: hardcoded colors in ${files.length} guarded UI files:`, false);
