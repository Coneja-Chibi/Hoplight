/**
 * Pure detectors for the repo guardrails - the functional core the git/Claude-Code hooks wrap.
 * Every rule here is a deterministic function over strings and path lists: no fs, no git, no process,
 * so each is unit-tested directly in lib.test.ts. The thin imperative shells (gate.ts, branch-note.ts)
 * gather the real inputs (changed files, diffs, on-disk siblings) and carry a violation out as exit 2.
 *
 * These encode our standing doctrine mechanically so it stops being advisory:
 * - functional core, imperative shell -> a *-core.ts may not touch effects, and must own a test.
 * - trust nothing until verified -> a new branch in the shell needs a test or a recorded Verified note.
 */

/** A *-core.ts (or its test) - the files our "pure logic lives in -core" convention marks. */
export const isCoreFile = (path: string): boolean => /(^|\/)[^/]+-core\.ts$/.test(norm(path));

/** The imperative shell: the boot store and each app's mount file, where effects are wired. */
export const isShellFile = (path: string): boolean => {
  const p = norm(path);
  if (!p.startsWith("src/ui/")) return false;
  if (p.endsWith(".test.ts") || p.endsWith("-core.ts")) return false;
  return p === "src/ui/boot.ts" || /(^|\/)index\.ts$/.test(p);
};

export const isTestFile = (path: string): boolean => /\.test\.ts$/.test(norm(path));

const norm = (path: string): string => path.replace(/\\/g, "/");

/** Strip line and block comments so a rule never trips on a word inside prose. Crude but sufficient
 * for our own small, well-formed source (it is not a full tokenizer, and does not need to be). */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Effect tokens a pure core must never reach for. Each is matched against comment-stripped source. */
const IMPURE_PATTERNS: ReadonlyArray<readonly [label: string, re: RegExp]> = [
  ["document.", /\bdocument\s*\./],
  ["window.", /\bwindow\s*\./],
  ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/],
  ["fetch(", /\bfetch\s*\(/],
  ["Bun.", /\bBun\s*\./],
  ["process.", /\bprocess\s*\./],
  ['import "bun"', /from\s+["']bun["']/],
  ['import "node:*"', /from\s+["']node:/],
  ["require(", /\brequire\s*\(/],
];

/**
 * Effect tokens found in a *-core.ts source. Empty means the core is pure. A non-empty list is a
 * violation: the "logic" belongs in a shell, or the effect is misplaced.
 */
export function impureCoreTokens(source: string): string[] {
  const clean = stripComments(source);
  return IMPURE_PATTERNS.filter(([, re]) => re.test(clean)).map(([label]) => label);
}

/**
 * Core files among `changed` that have no sibling test on disk. `exists` is injected (the shell
 * passes a real fs check) so this stays pure and testable. A changed foo-core.ts must be backed by
 * foo-core.test.ts - naming something a core is a promise to test it.
 */
export function missingCoreSiblings(changed: string[], exists: (path: string) => boolean): string[] {
  return changed
    .filter(isCoreFile)
    .filter((p) => !isTestFile(p))
    .map((p) => norm(p))
    .filter((p) => !exists(p.replace(/-core\.ts$/, "-core.test.ts")))
    .map((p) => p.replace(/-core\.ts$/, "-core.test.ts"));
}

/** One added line inside a shell file, with the file it lives in (for a readable warning). */
export interface ShellBranchHit {
  file: string;
  line: string;
}

/** Parse a unified `git diff` into the added ("+") lines per file. Ignores the +++ header line. */
export function addedLinesByFile(diff: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let file = "";
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      const path = raw.slice(4).replace(/^b\//, "").trim();
      file = path === "/dev/null" ? "" : norm(path);
      continue;
    }
    if (raw.startsWith("diff --git") || raw.startsWith("--- ")) continue;
    if (file && raw.startsWith("+") && !raw.startsWith("+++")) {
      (out.get(file) ?? out.set(file, []).get(file)!).push(raw.slice(1));
    }
  }
  return out;
}

const BRANCH_RE = /^\s*(if|\}?\s*else\s+if|switch)\s*\(/;

/**
 * Added branch statements in shell files. A non-empty result is the one heuristic that would have
 * caught the follow-dialog bug (a new branch in boot.ts with no test). The caller pairs it with
 * "was any test touched / is there a Verified note" to decide whether to block.
 */
export function shellBranchHits(diff: string): ShellBranchHit[] {
  const hits: ShellBranchHit[] = [];
  for (const [file, lines] of addedLinesByFile(diff)) {
    if (!isShellFile(file)) continue;
    for (const line of lines) {
      if (BRANCH_RE.test(line)) hits.push({ file, line: line.trim() });
    }
  }
  return hits;
}

/** Does a commit message carry an explicit verification note that clears the branch-test block? */
export const hasVerifiedNote = (message: string): boolean =>
  /^\s*(verified|tested)\s*:\s*\S+/im.test(message);

/** Raw HTML-injection sinks banned in UI source (ADR-008): the auto-escape rule has no quiet
 * exceptions. Static SVG constants parse via DOMParser + importNode instead (the `icon` pattern). */
const HTML_SINKS: ReadonlyArray<readonly [label: string, re: RegExp]> = [
  ["innerHTML", /\.\s*(inner|outer)HTML\s*=/],
  ["insertAdjacentHTML", /\.insertAdjacentHTML\s*\(/],
  ["document.write", /\bdocument\s*\.\s*write(ln)?\s*\(/],
  ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
  ["srcdoc", /\.srcdoc\s*=|setAttribute\s*\(\s*["']srcdoc["']/],
];

/** Files allowed to carry a sink. Empty ON PURPOSE - grow it only with an ADR-referenced reason. */
export const HTML_SINK_ALLOWLIST: ReadonlySet<string> = new Set<string>([]);

/** Banned HTML-injection sinks found in a UI source file (comment-stripped). Empty = clean. */
export function htmlSinkTokens(path: string, source: string): string[] {
  const p = path.replace(/\\/g, "/");
  if (!p.startsWith("src/ui/") || (!p.endsWith(".ts") && !p.endsWith(".tsx"))) return [];
  if (p.endsWith(".test.ts") || HTML_SINK_ALLOWLIST.has(p)) return [];
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return HTML_SINKS.filter(([, re]) => re.test(clean)).map(([label]) => label);
}

const DEP_LINE_RE = /^\s*"(@?[\w./-]+)"\s*:\s*"(?:[~^]?\d|workspace|latest|next|file:|git|npm:)[^"]*"\s*,?\s*$/;

/** Dependency names ADDED to package.json in a unified diff (version-shaped values only, so
 * scripts/config keys never match). A name that ALSO appears on a removed line is an edit or
 * comma-churn re-emit, not a new dependency, and does not count. */
export function addedDependencies(diff: string): string[] {
  const removed = new Set<string>();
  let inPkg = false;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      inPkg = /(^|\/)package\.json$/.test(raw.slice(4).replace(/^b\//, "").trim());
      continue;
    }
    if (!inPkg || !raw.startsWith("-") || raw.startsWith("---")) continue;
    const m = DEP_LINE_RE.exec(raw.slice(1));
    if (m) removed.add(m[1]!);
  }
  const out: string[] = [];
  for (const [file, lines] of addedLinesByFile(diff)) {
    if (!/(^|\/)package\.json$/.test(file)) continue;
    for (const line of lines) {
      const m = DEP_LINE_RE.exec(line);
      if (m && !removed.has(m[1]!)) out.push(m[1]!);
    }
  }
  return out;
}

/** Apps and setup steps may reach the shell ONLY through ctx (contract v2). A direct import of a
 * shell module gets bundled PER-APP, which forks the module: a second store instance, a second menu
 * universe, a second React - the exact split-brain class that black-screened the first React boot.
 * Returns the offending import specifiers found in an app/setup source file. */
export function shellImportTokens(path: string, source: string): string[] {
  const p = path.replace(/\\/g, "/");
  if (!/^src\/ui\/(apps|setup)\//.test(p)) return [];
  if (p.endsWith(".test.ts") || p.endsWith(".test.tsx")) return [];
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const out: string[] = [];
  const re = /from\s+["']([^"']*\/shell\/[^"']*|[^"']*\/shell)["']/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) out.push(m[1]!);
  return out;
}

/** Does the commit message declare the new dependency? (One line per package, with a reason.) */
export const declaresDependency = (message: string, pkg: string): boolean =>
  new RegExp(`^\\s*new-dependency\\s*:\\s*${pkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\b\\s*\\S`, "im").test(message);

// -- no hardcoded colors: UI wears tokens, not raw hex ----------------------------------------------

/** The only src/ui files where a raw color literal is legitimate: the token DEFINITIONS, and the few
 * modules whose whole job IS color (the HSV math, the platform brand-color data). Everything else must
 * reference a token (var(--x)). */
const COLOR_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  "src/ui/theme/tokens.css",
  "src/ui/_shared/color-math.ts",
  "src/ui/_shared/color-math.test.ts",
  "src/ui/_shared/platform-registry.ts",
  "src/ui/_shared/platform-registry.test.ts",
]);

/** A UI style/component file the color rule guards: a .module.css or .tsx under src/ui, not a
 * definition/color-domain file. These must theme through tokens; a raw color literal is a violation. */
export const isColorGuardedFile = (path: string): boolean => {
  const p = norm(path);
  if (!p.startsWith("src/ui/")) return false;
  if (!p.endsWith(".module.css") && !p.endsWith(".tsx")) return false;
  return !COLOR_ALLOWLIST.has(p);
};

/** A hardcoded color literal: a hex color, or an rgb/rgba/hsl/hsla function with literal channels.
 * The `(?<!&)` guard skips HTML numeric entities (`&#9679;`, `&#x2022;`) - glyphs, not colors. */
const COLOR_LITERAL = /(?<!&)#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/;

/**
 * The first hardcoded color literal on a line, or null when there is none. A line carrying the token
 * `hardcode-ok` (in a comment) opts out - the rare legitimate one-off (a brand-color datum, a
 * documented exception). Everything else should be a `var(--token)`. Pure, so both the pre-commit
 * diff-block and the retroactive scan share exactly this decision.
 */
export const hardcodedColorLiteral = (line: string): string | null => {
  if (line.includes("hardcode-ok")) return null;
  const m = COLOR_LITERAL.exec(line);
  return m ? m[0] : null;
};

/** Default max length for a source file, in lines. Past this a file is trending toward a godfile:
 * split it into one-concept pieces. Known offenders are grandfathered in big-files.json at their
 * current length (shrink-only) - see file-lines.ts. */
export const DEFAULT_LINE_CAP = 500;

/** A source file the size cap guards: .ts/.tsx/.css under src or scripts, excluding type decls. */
export const isLineGuardedFile = (path: string): boolean => {
  const p = norm(path);
  if (!p.startsWith("src/") && !p.startsWith("scripts/")) return false;
  if (p.endsWith(".d.ts")) return false;
  return p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".css");
};

/**
 * A violation message when a guarded file runs longer than its cap, else null. `ceilings` grandfathers
 * known-long files at a frozen length (they may only shrink); every other file caps at DEFAULT_LINE_CAP.
 * Pure - the caller counts the lines - so the pre-commit gate and the retroactive scan share one rule.
 */
export const overLineCap = (
  path: string,
  lines: number,
  ceilings: Readonly<Record<string, number>>,
): string | null => {
  if (!isLineGuardedFile(path)) return null;
  const p = norm(path);
  const grandfathered = p in ceilings;
  const cap = grandfathered ? ceilings[p]! : DEFAULT_LINE_CAP;
  if (lines <= cap) return null;
  return grandfathered
    ? `${p} is ${lines} lines, past its frozen ceiling of ${cap}. Known godfile: split it (that is the plan), never grow it.`
    : `${p} is ${lines} lines, past the ${DEFAULT_LINE_CAP}-line cap. Split it into one-concept files before committing.`;
};
