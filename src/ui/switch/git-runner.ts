/**
 * Git operations for a source-checkout version switch, behind an injected interface so the source engine's
 * orchestration (source-engine.ts) is unit-tested with a fake and this thin real edge stays trivial. Every
 * spawn is an argv ARRAY (no shell) with windowsHide (no console flash); refs are shape-validated by the
 * caller before they ever reach argv, so a "--force"-shaped tag cannot become an option.
 */

export interface GitRunner {
  /** The ref to restore to on failure: the current branch name, or the detached HEAD sha. */
  currentRef(): Promise<string>;
  /** Tracked files with uncommitted changes (untracked WIP is ignored; it does not block a checkout). */
  dirtyTrackedFiles(): Promise<string[]>;
  fetchTags(): Promise<void>;
  tagExists(tag: string): Promise<boolean>;
  /** Check out a ref (a tag on switch, the captured prior ref on restore). */
  checkout(ref: string): Promise<void>;
  /** Reinstall dependencies for the checked-out ref's lockfile. */
  install(): Promise<void>;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function run(argv: string[], cwd: string): Promise<RunResult> {
  const proc = Bun.spawn(argv, { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", windowsHide: true });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

/** The real git edge, rooted at the app's checkout. `bun` is the install runner (this project's toolchain). */
export function realGitRunner(cwd: string): GitRunner {
  const git = (...args: string[]): Promise<RunResult> => run(["git", ...args], cwd);
  return {
    async currentRef(): Promise<string> {
      const branch = await git("symbolic-ref", "--short", "-q", "HEAD");
      const name = branch.stdout.trim();
      if (name) return name;
      const sha = await git("rev-parse", "HEAD");
      return sha.stdout.trim();
    },
    async dirtyTrackedFiles(): Promise<string[]> {
      const res = await git("status", "--porcelain", "--untracked-files=no");
      return res.stdout
        .split(/\r?\n/)
        .map((l) => l.slice(3).trim()) // strip the 2-char status + space
        .filter((f) => f.length > 0);
    },
    async fetchTags(): Promise<void> {
      const res = await git("fetch", "--tags", "--quiet");
      if (res.code !== 0) throw new Error(`switch: could not fetch releases (${res.stderr.trim()})`);
    },
    async tagExists(tag: string): Promise<boolean> {
      const res = await git("rev-parse", "-q", "--verify", `refs/tags/${tag}`);
      return res.code === 0;
    },
    async checkout(ref: string): Promise<void> {
      const res = await git("-c", "advice.detachedHead=false", "checkout", "--quiet", ref);
      if (res.code !== 0) {
        // surface git's real reason (e.g. an untracked file in the way) rather than a generic failure
        throw new Error(`switch: git checkout failed: ${res.stderr.trim() || res.stdout.trim()}`);
      }
    },
    async install(): Promise<void> {
      const res = await run(["bun", "install"], cwd);
      if (res.code !== 0) throw new Error(`switch: bun install failed: ${res.stderr.trim()}`);
    },
  };
}
