/**
 * The audit launcher (bun). Seeds a scratch studio through the REAL adapters, boots the real
 * server(s), compiles each requested walk for node (bun's own CDP transport hangs against
 * chromium - proven), runs them, and reaps. The walks enumerate the live app, so this suite
 * grows with the code; only walks/promises.ts is hand-grown (behavior expectations).
 *
 *   bun run audit               - every run
 *   bun run audit:rooms         - one run (rooms|library|editors|setup|promises|clicks)
 *   bun run audit:legibility:light / :dark - style-only sweeps pinned to one theme
 *   bun run audit:watch         - re-runs the quick set when src/ui changes
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, watch } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "audit-out");
const SEEDED = join(OUT, ".studio-seeded");
const FRESH = join(OUT, ".studio-fresh");
const BUILD = join(OUT, ".build");
const PORT_SEEDED = 8331;
const PORT_FRESH = 8332;

const ALL = ["rooms", "library", "editors", "promises", "clicks", "setup"] as const;
type RunName = (typeof ALL)[number];

async function seedStudio(): Promise<void> {
  rmSync(SEEDED, { recursive: true, force: true });
  for (const d of ["character", "lorebook", "persona", "preset", "regex"]) {
    mkdirSync(join(SEEDED, d), { recursive: true });
  }
  writeFileSync(
    join(SEEDED, "settings.json"),
    JSON.stringify({ setupComplete: true, theme: "stage", firstDeck: "character", publishTargets: ["Marinara"] }),
  );
  // a format folder's default export may be one adapter or the whole family array
  const pickKind = (mod: unknown, kind: string): { toCanonical: (i: unknown) => { id: string } } => {
    const d = (mod as { default: unknown }).default;
    const list = Array.isArray(d) ? d : [d];
    const hit = list.find((a) => (a as { kind?: string }).kind === kind);
    if (!hit) throw new Error(`audit seed: no ${kind} adapter in module`);
    return hit as { toCanonical: (i: unknown) => { id: string } };
  };
  const st = pickKind(await import("../../src/formats/sillytavern/index"), "character");
  const marinaraLorebook = pickKind(await import("../../src/formats/marinara/lorebook"), "lorebook");
  const marinaraPreset = pickKind(await import("../../src/formats/marinara/index"), "preset");
  const card = st.toCanonical({
    text: readFileSync(join(ROOT, "samples", "sillytavern", "characters", "v3-full.json"), "utf8"),
    filename: "v3-full.json",
  });
  card.id = "alice";
  writeFileSync(join(SEEDED, "character", "alice.json"), JSON.stringify(card));
  const book = marinaraLorebook.toCanonical({
    text: readFileSync(join(ROOT, "samples", "marinara", "lorebooks", "arcadia-world-lore.marinara.json"), "utf8"),
  });
  book.id = "arcadia";
  writeFileSync(join(SEEDED, "lorebook", "arcadia.json"), JSON.stringify(book));
  const preset = marinaraPreset.toCanonical({
    text: readFileSync(join(ROOT, "samples", "marinara", "presets", "marinara-universal-preset-v12.marinara.json"), "utf8"),
  });
  preset.id = "mari-universal";
  writeFileSync(join(SEEDED, "preset", "mari-universal.json"), JSON.stringify(preset));
  // persona + regex seeds (the create buttons' own empty bodies): without them those decks'
  // shelf views and editors never render, so the walks silently under-measure two whole kinds
  const { CANONICAL_SCHEMA_VERSION } = await import("../../src/core/canonical");
  const { emptyPersonaBody } = await import("../../src/entities/persona");
  const { emptyRegexSetBody } = await import("../../src/entities/regex");
  writeFileSync(
    join(SEEDED, "persona", "walk-persona.json"),
    JSON.stringify({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona", id: "walk-persona", body: emptyPersonaBody("Walk Persona") }),
  );
  writeFileSync(
    join(SEEDED, "regex", "walk-regex.json"),
    JSON.stringify({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "regex", id: "walk-regex", body: emptyRegexSetBody("Walk Regex") }),
  );
  rmSync(FRESH, { recursive: true, force: true });
  mkdirSync(FRESH, { recursive: true });
}

async function waitUp(port: number): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`audit: server on ${port} never answered`);
}

function bootServer(port: number, studio: string): { kill: () => void } {
  const proc = Bun.spawn(["bun", join(ROOT, "src", "cli.ts"), "ui", String(port), studio], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return { kill: () => proc.kill() };
}

function buildWalk(name: RunName): string {
  mkdirSync(BUILD, { recursive: true });
  const outFile = join(BUILD, `${name}.mjs`);
  const res = Bun.spawnSync(
    ["bun", "build", join(ROOT, "scripts", "audit", "walks", `${name}.ts`), "--target=node", "--outfile", outFile, "--external", "playwright-core"],
    { cwd: ROOT },
  );
  if (res.exitCode !== 0) throw new Error(`audit: build failed for ${name}`);
  return outFile;
}

function runWalk(name: RunName, url: string, theme?: string): number {
  const file = buildWalk(name);
  const res = Bun.spawnSync(["node", file], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, AUDIT_URL: url, ...(theme ? { AUDIT_THEME: theme } : {}) },
  });
  return res.exitCode ?? 1;
}

async function runSet(names: RunName[], theme?: string): Promise<number> {
  await seedStudio();
  const seededSrv = bootServer(PORT_SEEDED, SEEDED);
  const needsFresh = names.includes("setup");
  const freshSrv = needsFresh ? bootServer(PORT_FRESH, FRESH) : null;
  try {
    await waitUp(PORT_SEEDED);
    if (freshSrv) await waitUp(PORT_FRESH);
    let worst = 0;
    for (const name of names) {
      console.log(`\n== audit:${name}${theme ? ` (${theme} only)` : ""} ==`);
      const url = name === "setup" ? `http://127.0.0.1:${PORT_FRESH}` : `http://127.0.0.1:${PORT_SEEDED}`;
      worst = Math.max(worst, runWalk(name, url, theme));
      if (name === "setup") {
        // the wizard writes settings; wipe for the next invocation
        rmSync(FRESH, { recursive: true, force: true });
        mkdirSync(FRESH, { recursive: true });
      }
    }
    return worst;
  } finally {
    seededSrv.kill();
    freshSrv?.kill();
  }
}

const arg = (process.argv[2] ?? "all").toLowerCase();
if (arg === "watch") {
  console.log("audit:watch - the quick set reruns when src/ui changes (ctrl+c stops)");
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  const kick = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (running) return;
      running = true;
      void runSet(["rooms", "promises"]).finally(() => {
        running = false;
        console.log("\naudit:watch - waiting for changes...");
      });
    }, 2500);
  };
  watch(join(ROOT, "src", "ui"), { recursive: true }, kick);
  kick();
} else if (arg === "legibility") {
  const theme = (process.argv[3] ?? "dark").toLowerCase();
  process.exit(await runSet(["rooms", "library", "editors"], theme));
} else if (arg === "all") {
  process.exit(await runSet([...ALL]));
} else if ((ALL as readonly string[]).includes(arg)) {
  process.exit(await runSet([arg as RunName]));
} else {
  console.log(`audit: unknown run "${arg}" (${ALL.join("|")}|all|legibility|watch)`);
  process.exit(2);
}
