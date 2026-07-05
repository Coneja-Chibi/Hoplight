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

/** Dependency names ADDED to package.json in a unified diff (version-shaped values only, so
 * scripts/config keys never match). */
export function addedDependencies(diff: string): string[] {
  const out: string[] = [];
  for (const [file, lines] of addedLinesByFile(diff)) {
    if (!/(^|\/)package\.json$/.test(file)) continue;
    for (const line of lines) {
      const m = /^\s*"(@?[\w./-]+)"\s*:\s*"(?:[~^]?\d|workspace|latest|next|file:|git|npm:)[^"]*"\s*,?\s*$/.exec(line);
      if (m) out.push(m[1]!);
    }
  }
  return out;
}

/** Does the commit message declare the new dependency? (One line per package, with a reason.) */
export const declaresDependency = (message: string, pkg: string): boolean =>
  new RegExp(`^\\s*new-dependency\\s*:\\s*${pkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\b\\s*\\S`, "im").test(message);
