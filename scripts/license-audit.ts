/**
 * Dependency license firewall: fail if a runtime/dev dep is AGPL, GPL, SSPL, or Elastic.
 * Product is AGPL-3.0-or-later; dependencies must stay MIT/Apache/BSD/ISC/etc.
 * Run: bun run scripts/license-audit.ts
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const FORBIDDEN = /\b(AGPL|GPL-3|GPL-2|LGPL|SSSPL|SSPL|Elastic|BUSL|Commons Clause)\b/i;

const names = [
  ...Object.keys(PKG.dependencies ?? {}),
  ...Object.keys(PKG.devDependencies ?? {}),
];

function packageDir(name: string): string | null {
  const direct = join(ROOT, "node_modules", name);
  if (existsSync(join(direct, "package.json"))) return direct;
  // scoped
  if (name.startsWith("@")) {
    const [scope, pkg] = name.split("/");
    const p = join(ROOT, "node_modules", scope!, pkg!);
    if (existsSync(join(p, "package.json"))) return p;
  }
  return null;
}

function licenseOf(dir: string): string {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    license?: string | { type?: string };
    licenses?: Array<{ type?: string }>;
  };
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license === "object" && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => l.type ?? "").join(" OR ");
  }
  // LICENSE file fallback
  for (const f of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"]) {
    const p = join(dir, f);
    if (existsSync(p) && statSync(p).isFile()) {
      const head = readFileSync(p, "utf8").slice(0, 400);
      if (/MIT/i.test(head)) return "MIT (file)";
      if (/Apache/i.test(head)) return "Apache (file)";
      if (FORBIDDEN.test(head)) return head.slice(0, 80);
    }
  }
  return "(unknown)";
}

const bad: Array<{ name: string; license: string }> = [];
const rows: Array<{ name: string; license: string }> = [];

for (const name of names.sort()) {
  const dir = packageDir(name);
  if (!dir) {
    bad.push({ name, license: "(not installed)" });
    continue;
  }
  const license = licenseOf(dir);
  rows.push({ name, license });
  if (FORBIDDEN.test(license) || license === "(not installed)") {
    bad.push({ name, license });
  }
}

console.log("vaud license audit (direct deps)\n");
for (const r of rows) {
  console.log(`  ${r.name.padEnd(28)} ${r.license}`);
}

if (bad.length > 0) {
  console.error("\nFAIL: forbidden or missing license:");
  for (const b of bad) console.error(`  ${b.name}: ${b.license}`);
  process.exit(2);
}

console.log("\nOK: no AGPL/GPL/SSPL/Elastic direct dependencies.\n");
process.exit(0);
