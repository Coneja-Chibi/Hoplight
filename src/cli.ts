#!/usr/bin/env bun
/**
 * hoplight - the Hoplight command line.
 * First heartbeat: it boots, it knows who it is, it tells you what is coming.
 * The engine (canonical model + format adapters) gets poured in next.
 */

import { basename, extname, join } from "node:path";
import { homedir } from "node:os";
import { CANONICAL_SCHEMA_VERSION, registry, primaryOriginalRaw } from "./core";
import type { AdapterInput, FormatAdapter } from "./core";
import { convertFile } from "./convert";
import {
  assertContainerAgreement,
  guardConvertOutput,
  normalizeExtension,
  parseConvertFlags,
  publishAtomic,
  shouldHoldConsole,
} from "./cli-io";
import { labelCard, sniffContainer } from "./entities/character/provenance";
import { PACKAGED_ASSETS } from "./generated/packaged-assets";
import { ensureFormats } from "./ensure-formats";
import { APP_VERSION as VERSION } from "./version";
import { resolveDefaultStudioDir } from "./studio/resolve-dir";
import { validateAdapterOutput } from "./cli-validation";

/** Read a file into the shape adapters expect: bytes always, text when it is UTF-8-ish. */
async function readInput(path: string): Promise<AdapterInput> {
  const file = Bun.file(path);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const input: AdapterInput = { bytes, filename: basename(path) };
  // Give text adapters a decoded view when the bytes look like text (json, not png/zip).
  const ext = extname(path).toLowerCase();
  if (ext === ".json" || ext === ".txt") {
    try {
      input.text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      /* not text; leave bytes only */
    }
  }
  return input;
}

/** Write adapter output atomically after container agreement is already checked. */
async function writeOutput(path: string, out: { bytes?: Uint8Array; text?: string }): Promise<void> {
  if (out.bytes) await publishAtomic(path, out.bytes);
  else await publishAtomic(path, out.text ?? "");
}

/** Either a resolved target adapter or a reason it could not be resolved - never both, never neither. */
type Resolved = { ok: true; adapter: FormatAdapter } | { ok: false; error: string };

/**
 * Pick the output adapter: an explicit --to wins; otherwise resolve by the output extension,
 * which adapters own via outputExtensions. An extension written by more than one adapter (e.g.
 * .json for both sillytavern and vaud-json) is honestly reported as ambiguous instead of guessed.
 */
function resolveTarget(forced: string | undefined, outPath: string): Resolved {
  if (forced) {
    const adapter = registry.get(forced);
    return adapter ? { ok: true, adapter } : { ok: false, error: `Unknown format "${forced}".` };
  }
  const ext = extname(outPath).toLowerCase().replace(/^\./, "");
  const candidates = registry.targetsForExtension(ext);
  if (candidates.length === 1) return { ok: true, adapter: candidates[0]! };
  if (candidates.length === 0) return { ok: false, error: `Cannot tell what format to write for ".${ext}".` };
  const ids = candidates.map((a) => a.id).join(", ");
  return { ok: false, error: `".${ext}" is written by more than one format (${ids}).` };
}

/**
 * Best-effort recover the source card object for labeling: the detected adapter's kept raw
 * (works for png/charx without re-implementing extraction), else a direct JSON parse. Always a raw
 * card object or undefined - never the canonical entity, whose shape the labeler cannot read.
 */
function sourceCardOf(src: FormatAdapter | undefined, input: AdapterInput): unknown {
  if (src) {
    try {
      const raw = primaryOriginalRaw(src.toCanonical(input).original);
      if (raw !== undefined) return raw;
    } catch {
      /* fall through to a raw parse */
    }
  }
  if (typeof input.text === "string") {
    try {
      return JSON.parse(input.text);
    } catch {
      /* not json */
    }
  }
  return undefined;
}

const BANNER = `
  hoplight  ${VERSION}
  the forge for AI-roleplay content
`;

const HELP = `${BANNER}
  Usage
    hoplight <command> [options]

  Commands
    convert <in> <out>    Convert a file from one format to another
    inspect <file>        Show what is inside a file
    validate <file>       Detect + parse; exit 0 if hoplight can open it
    label <file>          Guess a card's format and which app it is likely from
    formats               List the formats hoplight knows about
    ui [port] [studio]    Open the Studio on loopback (remote access is configured inside the Studio)
    version               Print the version
    help                  Print this help

  Options
    -v, --version         Print the version
    -h, --help            Print this help
    --to <format>         convert: force the output format (else resolved from the <out> extension)
    --yes                 convert: allow replacing an existing output file (never overwrites input)
    --json                version/formats/validate/convert: machine-readable stdout

  Example
    hoplight convert vera.png vera.charx --to risu
    hoplight convert card.json out.charx --to lumiverse --yes
    hoplight validate samples/sillytavern/characters/v3-full.json

  Status
    Converter jewel (M1): open/inspect/validate/convert across discovered adapters.
    Schema v${CANONICAL_SCHEMA_VERSION}. Format matrix: docs/FORMAT-SUPPORT.md
`;

const wantsJson = (args: string[]): boolean => args.includes("--json");

/**
 * Keep a double-clicked console on screen long enough to read. The decision lives in cli-io.ts so it
 * is testable; this is only the impure wait. Anything that is not an interactive Windows console
 * returns immediately, so a pipe, a script, or CI can never block here.
 */
async function holdConsoleIfClicked(noArguments: boolean): Promise<void> {
  const hold = shouldHoldConsole({
    platform: process.platform,
    noArguments,
    stdinIsTty: Boolean(process.stdin.isTTY),
    stdoutIsTty: Boolean(process.stdout.isTTY),
  });
  if (!hold) return;
  console.log("  This is the command-line tool. Run it from a terminal with a command above.");
  console.log("  Looking for the app? That is Hoplight.exe.\n");
  console.log("  Press Enter to close.");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    process.stdin.resume();
  });
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const first = args[0];
  const json = wantsJson(args);

  if (first === "-v" || first === "--version" || first === "version") {
    if (json) console.log(JSON.stringify({ version: VERSION, schema: CANONICAL_SCHEMA_VERSION }));
    else console.log(VERSION);
    return 0;
  }

  if (!first || first === "-h" || first === "--help" || first === "help") {
    console.log(HELP);
    await holdConsoleIfClicked(!first);
    return 0;
  }

  if (first === "formats") {
    await ensureFormats();
    const found = registry.all();
    if (json) {
      console.log(
        JSON.stringify(
          {
            schema: CANONICAL_SCHEMA_VERSION,
            adapters: found.map((a) => ({
              id: a.id,
              kind: a.kind,
              label: a.label,
              outputExtensions: a.outputExtensions,
            })),
          },
          null,
          2,
        ),
      );
      return 0;
    }
    const source = PACKAGED_ASSETS !== null ? "packaged in this build" : "discovered in src/formats/";
    console.log(`\n  Adapters ${source} (canonical schema v${CANONICAL_SCHEMA_VERSION}):`);
    if (found.length === 0) {
      console.log("    (none yet)");
    } else {
      for (const a of found) console.log(`    - ${a.id.padEnd(12)} writes .${a.outputExtensions.join(", .").padEnd(6)} ${a.label}`);
    }
    console.log(`\n  Matrix: docs/FORMAT-SUPPORT.md (regen: bun run matrix)`);
    console.log(`  Drop a folder into src/formats/ to add one (copy src/formats/_template).\n`);
    return 0;
  }

  if (first === "validate") {
    const path = args.find((a) => a !== "validate" && a !== "--json");
    if (!path) {
      console.log(`\n  Usage: hoplight validate <file> [--json]\n`);
      return 1;
    }
    await ensureFormats();
    const input = await readInput(path);
    const src = registry.detect(input);
    if (!src) {
      if (json) console.log(JSON.stringify({ ok: false, path, error: "unrecognized" }));
      else {
        console.log(`\n  INVALID  ${path}`);
        console.log(`  hoplight does not recognize this file.\n`);
      }
      return 1;
    }
    try {
      const ent = validateAdapterOutput(src, input);
      const name =
        ent.kind === "character"
          ? ent.body.identity.name
          : ent.kind === "lorebook"
            ? ent.body.name
            : ent.body.name;
      if (json) {
        console.log(JSON.stringify({ ok: true, path, format: src.id, kind: ent.kind, name }));
      } else {
        console.log(`\n  OK  ${path}`);
        console.log(`  format  ${src.id}`);
        console.log(`  kind    ${ent.kind}`);
        console.log(`  name    ${name || "(unnamed)"}\n`);
      }
      return 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) console.log(JSON.stringify({ ok: false, path, format: src.id, error: msg }));
      else console.log(`\n  INVALID  ${path}\n  ${msg}\n`);
      return 1;
    }
  }

  /**
   * `hoplight mcp` - serve the studio's tools over MCP on stdio.
   *
   * The subcommand exists so nothing has to know where Hoplight's source lives. Kit's Claude
   * provider spawns this same binary, and a person can register it with their own client
   * (`claude mcp add --transport stdio hoplight -- hoplight mcp`). A packaged build has no
   * src/mcp/main.ts on disk to point at, so pointing at a FILE was only ever going to work from a
   * checkout.
   *
   * Nothing may be written to stdout here but protocol frames: one stray line is a malformed frame
   * and the client drops the session. That is why this branch returns before any of the console
   * output the other subcommands print.
   */
  if (first === "mcp") {
    await ensureFormats();
    const { runMcpServer } = await import("./mcp/run");
    // Full belt by default: a person registering this with their own client gets that client's
    // permission prompt before every call. --read-only is for a caller that suppresses it.
    const dir = args.slice(1).find((a) => !a.startsWith("--"));
    await runMcpServer({ studioDir: dir, readOnly: args.includes("--read-only") });
    return 0;
  }

  if (first === "ui") {
    await ensureFormats();
    const { startUi } = await import("./ui/server");
    const port = Number(args[1]) || 8321;
    // Default matches the compiled exe: the user's own Documents. A repo-relative "studio" default
    // scattered entities into whatever cwd the command ran from.
    const studioDir = args[2] ?? resolveDefaultStudioDir(homedir());
    const { url, sandboxUrl } = startUi(port, studioDir, PACKAGED_ASSETS ?? undefined);
    const { forwardingGuide } = await import("./ui/forwarding");
    const guide = forwardingGuide(
      new URL(url).port,
      sandboxUrl ? new URL(sandboxUrl).port : undefined,
    );
    console.log(`\n  Hoplight. is up: ${url}`);
    console.log(`  studio folder: ${studioDir} (your entities live there as plain canonical json)\n`);
    console.log("  Opening it from another computer or a container host?");
    console.log(`  1. Run: ${guide.sshCommand}`);
    console.log(`  2. Open: ${guide.localUrl}`);
    console.log("  Replace user@server with your SSH login. Keep this terminal and the tunnel open.\n");
    // Bun.serve keeps the process alive; ctrl-c to close the studio.
    return await new Promise<number>(() => {});
  }

  if (first === "inspect") {
    const path = args[1];
    if (!path) {
      console.log(`\n  Usage: hoplight inspect <file>\n`);
      return 1;
    }
    await ensureFormats();
    const input = await readInput(path);
    const src = registry.detect(input);
    if (!src) {
      console.log(`\n  hoplight does not recognize "${path}".`);
      console.log(`  Known formats: ${registry.all().map((a) => a.id).join(", ")}\n`);
      return 1;
    }
    const ent = validateAdapterOutput(src, input);
    console.log(`\n  ${path}`);
    console.log(`    format   ${src.id}  (${src.label})`);
    console.log(`    kind     ${ent.kind}`);
    if (ent.kind === "lorebook") {
      const b = ent.body;
      console.log(`    name     ${b.name || "(unnamed)"}`);
      console.log(`    type     ${b.lorebookType ?? "(none)"}`);
      console.log(`    entries  ${b.entries.length}`);
      console.log(`    budget   ${b.tokenBudget} (${b.budgetMode})\n`);
    } else if (ent.kind === "persona") {
      const b = ent.body;
      console.log(`    name     ${b.name || "(unnamed)"}`);
      console.log(`    brief    ${b.brief ? `${b.brief.slice(0, 60)}...` : "(none)"}`);
      console.log(`    content  ${b.content ? `${b.content.length} chars` : "(empty)"}`);
      console.log(`    sections ${b.sections ? Object.keys(b.sections).join(", ") : "(none)"}\n`);
    } else if (ent.kind === "regex") {
      const b = ent.body;
      console.log(`    name     ${b.name || "(unnamed)"}`);
      console.log(`    rules    ${b.rules.length}\n`);
    } else if (ent.kind === "preset") {
      const b = ent.body;
      console.log(`    name     ${b.name || "(unnamed)"}`);
      console.log(`    prompts  ${b.prompts.length}`);
      console.log(`    groups   ${b.groups?.length ?? 0}`);
      console.log(`    choices  ${b.choices?.length ?? 0}\n`);
    } else if (ent.kind === "pack") {
      const b = ent.body;
      console.log(`    name     ${b.name || "(unnamed)"}`);
      console.log(`    assets   ${b.pack.items.length}`);
      console.log(`    groups   ${Object.keys(b.groups ?? {}).length}\n`);
    } else {
      const b = ent.body;
      console.log(`    name     ${b.identity.name || "(unnamed)"}`);
      const g = b.greetings;
      console.log(`    greeting ${g.firstMessage ? `${g.firstMessage.slice(0, 60)}...` : "(none)"}`);
      console.log(`    alts     ${g.alternateGreetings?.length ?? 0}`);
      console.log(`    tags     ${b.discovery.tags?.join(", ") || "(none)"}\n`);
    }
    return 0;
  }

  if (first === "label") {
    const path = args[1];
    if (!path) {
      console.log(`\n  Usage: hoplight label <file>\n`);
      return 1;
    }
    await ensureFormats();
    const input = await readInput(path);
    const card = sourceCardOf(registry.detect(input), input);
    const label = labelCard(card, sniffContainer(input));
    const origin = label.likelyOrigin
      ? `${label.likelyOrigin} (confidence ${label.confidence.toFixed(2)})`
      : "(unknown)";
    console.log(`\n  ${path}`);
    console.log(`    format    ${label.format}`);
    console.log(`    container ${label.container}`);
    console.log(`    origin    ${origin}`);
    console.log(`    signals   ${label.signals.length ? label.signals.join(", ") : "(none)"}\n`);
    return 0;
  }

  if (first === "convert") {
    const convertArgs = args.slice(1).filter((a) => a !== "--json");
    const flags = parseConvertFlags(convertArgs);
    if (!flags.ok) {
      console.log(`\n  ${flags.error}`);
      console.log(`  Usage: hoplight convert <in> <out> [--to <format>] [--yes] [--strict]\n`);
      return 1;
    }
    const inPath = flags.rest[0];
    const outPath = flags.rest[1];
    if (!inPath || !outPath || flags.rest.length !== 2) {
      console.log(`\n  Usage: hoplight convert <in> <out> [--to <format>] [--yes] [--strict]\n`);
      return 1;
    }

    const guard = await guardConvertOutput(inPath, outPath, flags.yes);
    if (!guard.ok) {
      console.log(`\n  ${guard.error}\n`);
      return 1;
    }

    await ensureFormats();
    const input = await readInput(inPath);
    const src = registry.detect(input);
    if (!src) {
      console.log(`\n  hoplight does not recognize "${inPath}".`);
      console.log(`  Known formats: ${registry.all().map((a) => a.id).join(", ")}\n`);
      return 1;
    }

    const target = resolveTarget(flags.to, outPath);
    if (!target.ok) {
      console.log(`\n  ${target.error}`);
      console.log(`  Pass one explicitly: hoplight convert ${inPath} ${outPath} --to <format>`);
      console.log(`  Known formats: ${registry.all().map((a) => a.id).join(", ")}\n`);
      return 1;
    }

    const requestedExtension = normalizeExtension(outPath);
    let out: Awaited<ReturnType<typeof convertFile>>["out"];
    let lorebooks: Awaited<ReturnType<typeof convertFile>>["lorebooks"];
    try {
      const result = convertFile(src, target.adapter, input, { requestedExtension });
      out = result.out;
      lorebooks = result.lorebooks;
    } catch (e) {
      console.log(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
      return 1;
    }

    const agree = assertContainerAgreement(requestedExtension, out.suggestedExtension, out);
    if (!agree.ok) {
      console.log(`\n  ${agree.error}\n`);
      return 1;
    }

    const report = out.report;
    if (!report) {
      console.log("\n  convert: target did not produce a serialize report\n");
      return 1;
    }
    if (flags.strict) {
      if (report.coverage === "unknown") {
        console.log("\n  strict export refused: target coverage is not declared; loss is unknown\n");
        return 1;
      }
      if (report.dropped.length > 0) {
        console.log(`\n  strict export refused: ${report.dropped.length} field(s) would be dropped`);
        for (const field of report.dropped) console.log(`  - ${field}`);
        console.log("");
        return 1;
      }
    }

    try {
      await writeOutput(outPath, out);
    } catch (e) {
      console.log(`\n  write failed: ${e instanceof Error ? e.message : String(e)}\n`);
      return 1;
    }

    if (json) {
      console.log(
        JSON.stringify({
          ok: true,
          from: src.id,
          to: target.adapter!.id,
          in: inPath,
          out: outPath,
          extension: out.suggestedExtension,
          lorebooks: lorebooks.length,
          bytes: out.bytes?.length ?? 0,
          textChars: out.text?.length ?? 0,
          report,
        }),
      );
      return 0;
    }
    console.log(`\n  ${src.id} -> ${target.adapter!.id}`);
    console.log(`  ${inPath}  ->  ${outPath} (.${out.suggestedExtension})`);
    if (lorebooks.length > 0) {
      const total = lorebooks.reduce((n, l) => n + l.body.entries.length, 0);
      console.log(`  + embedded lorebook carried across (${total} entr${total === 1 ? "y" : "ies"})`);
    }
    const dropped = report.coverage === "unknown"
      ? `unknown dropped (${report.dropped.length} confirmed)`
      : `${report.dropped.length} dropped`;
    console.log(
      `  report: ${report.escrowed.length} escrowed, ${dropped}, ` +
        `${report.escrowShadowed.length} shadowed, ${report.warnings.length} warning(s)`,
    );
    for (const field of report.dropped) console.log(`  - dropped: ${field}`);
    for (const warning of report.warnings) console.log(`  - warning: ${warning}`);
    console.log("");
    return 0;
  }

  console.log(`\n  Unknown command: ${first}`);
  console.log(`  Run "hoplight help" to see what is available.\n`);
  return 1;
}

process.exit(await main(process.argv));
