/**
 * Prose guards - two repo-wide honesty checks for text that strangers read:
 *
 *   --emdash : no em dash (U+2014) anywhere in prose or copy. The character is allowed only as
 *              DATA (a regex recipe that processes it), marked with an `emdash-ok` comment on the
 *              same line - the same opt-out pattern the color guard uses.
 *   --links  : every relative markdown link resolves to a real file. A doc citing a path that is
 *              not in the repo is a 404 for every reader but the author.
 *
 * Both walk docs/, specs/, src/, scripts/, templates/ plus the root *.md files, skipping vendor,
 * sample, fixture, and generated trees (third-party data is not ours to retypeset).
 * Exit 1 on any hit so verify:ci fails loud. Run: bun run scripts/hooks/prose-guards.ts --emdash
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOTS = ["docs", "specs", "src", "scripts", "templates"];
const ROOT_FILES = ["README.md", "LICENSING.md", "CONTRIBUTING.md"];
const EXTS = new Set([".md", ".ts", ".tsx", ".css", ".html"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "samples", "fixtures", "generated", "vendor"]);

const guardedExt = (name: string): boolean => {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && EXTS.has(name.slice(dot));
};

function walk(dir: string, out: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      walk(full, out);
    } else if (guardedExt(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = (): string[] => [
  ...ROOTS.flatMap((r) => walk(r)),
  ...ROOT_FILES.filter((f) => existsSync(f)),
];

function checkEmdash(): string[] {
  const hits: string[] = [];
  for (const path of files()) {
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("—") && !line.includes("emdash-ok")) {
        hits.push(`${path}:${i + 1}  ${line.trim().slice(0, 80)}`);
      }
    });
  }
  return hits;
}

/** Relative markdown links only: [label](path). http(s), mailto, and #fragments are not ours to check. */
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;

function checkLinks(): string[] {
  const hits: string[] = [];
  for (const path of files()) {
    if (!path.endsWith(".md")) continue;
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(LINK_RE)) {
      const raw = m[1]!;
      if (/^(https?:|mailto:|#)/i.test(raw)) continue;
      const target = raw.split("#")[0]!;
      if (target === "") continue;
      const resolved = join(dirname(path), decodeURI(target));
      if (!existsSync(resolved)) {
        hits.push(`${path}: dead link -> ${raw}`);
      } else if (statSync(resolved).isDirectory() && !existsSync(join(resolved, "README.md"))) {
        // a directory link is fine only if a reader landing there finds a README
        hits.push(`${path}: directory link with no README -> ${raw}`);
      }
    }
  }
  return hits;
}

const mode = process.argv[2];
const hits = mode === "--emdash" ? checkEmdash() : mode === "--links" ? checkLinks() : null;
if (hits === null) {
  console.error("prose-guards: pass --emdash or --links");
  process.exit(1);
}
if (hits.length > 0) {
  const what = mode === "--emdash" ? "em dash in prose (use emdash-ok only for data)" : "dead markdown link";
  console.error(`prose-guards: ${hits.length} ${what} hit(s):`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`prose-guards ${mode}: clean.`);
