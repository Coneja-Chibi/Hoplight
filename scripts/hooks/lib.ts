/**
 * Pure detectors for the repo guardrails - the functional core the git and editor hooks wrap.
 * Every rule here is a deterministic function over strings and path lists: no fs, no git, no process,
 * so each is unit-tested directly in lib.test.ts. Thin imperative shells gather the real inputs
 * (changed files, diffs, on-disk siblings) and carry a violation out as exit 2.
 *
 * These encode our standing doctrine mechanically so it stops being advisory:
 * - functional core, imperative shell -> a *-core.ts may not touch effects, and must own a test.
 * - trust nothing until verified -> structural hazards are rejected before expensive verification.
 */

/** A *-core.ts (or its test) - the files our "pure logic lives in -core" convention marks. */
export const isCoreFile = (path: string): boolean => /(^|\/)[^/]+-core\.ts$/.test(norm(path));

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
    // a DELETED core owes nothing: the promise to test it left with the file
    .filter((p) => exists(p))
    .filter((p) => !exists(p.replace(/-core\.ts$/, "-core.test.ts")))
    .map((p) => p.replace(/-core\.ts$/, "-core.test.ts"));
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

// -- no hardcoded colors: UI wears tokens, not raw hex ----------------------------------------------

/** The only src/ui files where a raw color literal is legitimate: the token DEFINITIONS, and the few
 * modules whose whole job IS color (the HSV math, the platform brand-color data). Everything else must
 * reference a token (var(--x)). */
const COLOR_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  "src/ui/theme/tokens.css",
  "src/ui/_shared/color-math.ts",
  "src/ui/_shared/platform-registry.ts",
  // CSS Workshop samples are user-authored paint data, not app chrome
  "src/ui/components/css-workshop/advanced-pane.tsx",
  "src/ui/components/css-workshop/index.tsx",
  "src/ui/components/css-workshop/knobs.tsx",
  "src/ui/components/css-workshop/source-pane.tsx",
  "src/ui/components/css-workshop/styles.module.css",
  // Workshop PAYLOAD css-in-strings: a sealed srcdoc mock of foreign host pages, and the starter
  // draft users paste onto Chub/Janitor - foreign pages cannot see our tokens, literals are correct
  "src/ui/components/css-workshop/preview.ts",
  "src/ui/apps/css-workshop/prefs.ts",
  // Sprite part defaults are character paint data (not chrome)
  "src/ui/components/sprite-parts/index.tsx",
  // Paint seeds are entity DATA defaults (saved into user documents), not chrome
  "src/ui/_shared/paint.ts",
]);

/** Allowlisted DIRECTORIES (drop-in payload folders where every file is user-paint data by design;
 * an exact-path list would silently un-guard nothing when a new recipe lands, so prefix-match). */
const COLOR_ALLOWLIST_DIRS: readonly string[] = [
  // Recipe payloads are CSS text inserted into user documents, not app chrome
  "src/ui/components/css-workshop/recipes/",
];

/** A UI style/component file the color rule guards: a .module.css, .tsx, or plain .ts under src/ui,
 * not a definition/color-domain file. These must theme through tokens; a raw color literal is a
 * violation. Plain .ts joined the net 2026-07-12: deck accents had been hiding there. */
export const isColorGuardedFile = (path: string): boolean => {
  const p = norm(path);
  if (!p.startsWith("src/ui/")) return false;
  if (p.endsWith(".test.ts") || p.endsWith(".test.tsx")) return false; // fixtures assert color DATA
  const guarded =
    p.endsWith(".module.css") || p.endsWith(".tsx") || (p.endsWith(".ts") && !p.endsWith(".d.ts"));
  if (!guarded) return false;
  if (COLOR_ALLOWLIST_DIRS.some((dir) => p.startsWith(dir))) return false;
  return !COLOR_ALLOWLIST.has(p);
};

/**
 * Hardcoded color: hex, or rgb/rgba/hsl/hsla with a numeric first channel.
 * Identifier calls like `rgb(a)` (color-math helpers) are NOT colors.
 * The `(?<!&)` guard skips HTML numeric entities (`&#9679;`).
 */
const HEX_COLOR = /(?<!&)#[0-9a-fA-F]{3,8}\b/;
const FUNC_COLOR = /\b(?:rgba?|hsla?)\s*\(\s*[\d.]/;

/**
 * The first hardcoded color literal on a line, or null when there is none. A line carrying the token
 * `hardcode-ok` (in a comment) opts out - the rare legitimate one-off (a brand-color datum, a
 * documented exception). Everything else should be a `var(--token)`. Pure, so both the pre-commit
 * diff-block and the retroactive scan share exactly this decision.
 */
export const hardcodedColorLiteral = (line: string): string | null => {
  if (line.includes("hardcode-ok")) return null;
  const hex = HEX_COLOR.exec(line);
  if (hex) return hex[0];
  const fn = FUNC_COLOR.exec(line);
  return fn ? fn[0] : null;
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
