/**
 * Generate Kit's static drop-in manifest, so a compiled binary can find its own parts.
 *
 * Kit discovers commands, tools, doctor checks, provider spokes and notify channels by reading the
 * folder they live in. That works from a source checkout and CANNOT work inside a single-file
 * executable: `import.meta.url` resolves onto Bun's virtual filesystem, which has no listable
 * directory, so the first discovery call threw ENOENT and Kit died before drawing anything.
 *
 * This is the same answer scripts/capability-manifest.ts already gives for the browser bundle: emit
 * static imports the bundler can follow. The folders stay the source of truth; --check fails the
 * build when a dropped-in file is missing from the manifest, so the convention still holds.
 *
 * Run:   bun run scripts/kit-manifest.ts
 * Check: bun run scripts/kit-manifest.ts --check
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUTPUT = join(ROOT, "src", "kit", "generated", "drop-ins.ts");
const CHECK_ONLY = process.argv.includes("--check");

/** The infra files each loader skips. Kept in step with the loader that owns each folder. */
const COMMAND_INFRA = new Set(["command.ts", "discover.ts"]);
const TOOL_INFRA = new Set(["tool.ts", "discover.ts"]);

const isDropIn = (name: string, infra: ReadonlySet<string> = new Set()): boolean =>
  name.endsWith(".ts")
  && !name.endsWith(".test.ts")
  && !name.startsWith("_")
  && !infra.has(name);

/**
 * Does this file actually default-export something?
 *
 * The folder walk imports every candidate and skips the ones whose `default` is undefined, which is
 * how files like tools/change-apply.ts sit in the folder while exporting a factory instead. A static
 * `import x from` those does not merely skip, it fails to compile, so they are filtered here as well.
 * The reading is textual and therefore fallible; drop-ins.test.ts compares this list against the real
 * walk, so a file wrongly included or skipped fails the build rather than going missing at runtime.
 */
const hasDefaultExport = (file: string): boolean => {
  const source = readFileSync(file, "utf8");
  return /^\s*export\s+default\s/m.test(source) || /\bas\s+default\b/.test(source);
};

/** Files directly inside one folder, sorted the way the loaders sort them. */
function filesIn(dir: string, infra?: ReadonlySet<string>): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isDropIn(entry.name, infra))
    .map((entry) => join(dir, entry.name))
    .filter(hasDefaultExport)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Every file under `root` that sits in a folder named `folder`. Mirrors the recursive walk in
 * commands/discover.ts and capabilities/discover.ts, which accept a file only when its own directory
 * carries the convention name.
 */
function filesUnder(root: string, folder: string, infra?: ReadonlySet<string>): string[] {
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (basename(dir) === folder && isDropIn(entry.name, infra) && hasDefaultExport(path)) found.push(path);
    }
  };
  visit(root);
  return found.sort((a, b) => a.localeCompare(b));
}

/** An import specifier relative to the generated file, POSIX-separated and extension-free. */
function specifier(file: string): string {
  const rel = relative(join(ROOT, "src", "kit", "generated"), file).replace(/\\/g, "/");
  const bare = rel.replace(/\.ts$/, "");
  return bare.startsWith(".") ? bare : `./${bare}`;
}

const families = [
  {
    name: "commands",
    type: "KitCommand",
    typeFrom: "../commands/command",
    files: filesUnder(join(ROOT, "src", "kit"), "commands", COMMAND_INFRA),
  },
  {
    name: "tools",
    type: "HarnessTool",
    typeFrom: "../tools/tool",
    files: filesIn(join(ROOT, "src", "kit", "tools"), TOOL_INFRA),
  },
  {
    name: "doctorChecks",
    type: "DoctorCheck",
    typeFrom: "../doctor/check",
    files: filesIn(join(ROOT, "src", "kit", "doctor", "checks")),
  },
  {
    name: "spokes",
    type: "ProviderSpoke",
    typeFrom: "../providers/spoke",
    files: filesIn(join(ROOT, "src", "kit", "providers", "spokes")),
  },
  {
    name: "notifyChannels",
    type: "NotifyChannel",
    typeFrom: "../render/notify/channel",
    files: filesIn(join(ROOT, "src", "kit", "render", "notify", "channels")),
  },
] as const;

const imports: string[] = [];
const bodies: string[] = [];
let counter = 0;

for (const family of families) {
  const names: string[] = [];
  for (const file of family.files) {
    const binding = `m${counter++}`;
    imports.push(`import ${binding} from "${specifier(file)}";`);
    names.push(binding);
  }
  // `unknown[]` then a shape check at the seam: a drop-in file that does not default-export the
  // right thing is skipped by the loader rather than crashing it, exactly as the folder walk does.
  bodies.push(
    `  /** ${family.files.length} drop-in(s) from the ${family.name} folder(s). */\n`
    + `  ${family.name}: [${names.join(", ")}] as unknown[],`,
  );
}

const source =
  `/**\n`
  + ` * GENERATED by scripts/kit-manifest.ts. Do not edit by hand; the folders are the source of truth.\n`
  + ` *\n`
  + ` * Static imports so a compiled Kit binary can reach its own drop-ins. A single-file executable has\n`
  + ` * no listable directory to walk, so without this the first discovery call fails and Kit never\n`
  + ` * starts. Run \`bun run kit:manifest\` after adding a drop-in; \`--check\` gates it in CI.\n`
  + ` *\n`
  + ` * Each list is \`unknown[]\` on purpose: every loader already shape-checks what a folder handed it,\n`
  + ` * and a file exporting the wrong thing must be skipped here the same way, not crash the binary.\n`
  + ` */\n`
  + `${imports.join("\n")}\n\n`
  + `/** Every drop-in Kit ships, in the same order the folder walk would return them. */\n`
  + `export const KIT_DROP_INS = {\n${bodies.join("\n")}\n} as const;\n\n`
  + `export type KitDropIns = typeof KIT_DROP_INS;\n`;

if (CHECK_ONLY) {
  const current = await Bun.file(OUTPUT).text().catch(() => "");
  if (current !== source) {
    console.error("kit-manifest:check: src/kit/generated/drop-ins.ts is stale");
    console.error("  repair: bun run kit:manifest");
    process.exit(1);
  }
  console.log(
    `kit-manifest:check: manifest is current (${families.map((f) => `${f.files.length} ${f.name}`).join(", ")})`,
  );
} else {
  await Bun.write(OUTPUT, source);
  console.log(
    `kit-manifest wrote ${relative(ROOT, OUTPUT)}: ${families.map((f) => `${f.files.length} ${f.name}`).join(", ")}`,
  );
}
