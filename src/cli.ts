#!/usr/bin/env bun
/**
 * vaud - the Vaudeville Studios command line.
 * First heartbeat: it boots, it knows who it is, it tells you what is coming.
 * The engine (canonical model + format adapters) gets poured in next.
 */

import { basename, extname } from "node:path";
import { CANONICAL_SCHEMA_VERSION, registry, loadFormats, primaryEscrowRaw } from "./core";
import type { AdapterInput, FormatAdapter } from "./core";
import { convertFile } from "./convert";
import { labelCard, sniffContainer } from "./entities/character/provenance";

const VERSION = "0.0.1";

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

/** Write an adapter's output (bytes for binary formats, text for json/text) to disk. */
async function writeOutput(path: string, out: { bytes?: Uint8Array; text?: string }): Promise<void> {
  await Bun.write(path, out.bytes ?? out.text ?? "");
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
 * Best-effort recover the source card object for labeling: the detected adapter's escrowed raw
 * (works for png/charx without re-implementing extraction), else a direct JSON parse. Always a raw
 * card object or undefined - never the canonical entity, whose shape the labeler cannot read.
 */
function sourceCardOf(src: FormatAdapter | undefined, input: AdapterInput): unknown {
  if (src) {
    try {
      const raw = primaryEscrowRaw(src.toCanonical(input).escrow);
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
  vaud  ${VERSION}
  the forge for AI-roleplay content
`;

const HELP = `${BANNER}
  Usage
    vaud <command> [options]

  Commands
    convert <in> <out>    Convert a file from one format to another
    inspect <file>        Show what is inside a file
    label <file>          Guess a card's format and which app it is likely from
    formats               List the formats vaud knows about
    version               Print the version
    help                  Print this help

  Options
    -v, --version         Print the version
    -h, --help            Print this help
    --to <format>         convert: force the output format (else resolved from the <out> extension)

  Example
    vaud convert vera.png vera.charx      SillyTavern PNG  ->  Risu .charx

  Status
    Engine core: canonical schema v${CANONICAL_SCHEMA_VERSION}, escrow, adapter contract.
    Run "vaud formats" to see the adapters vaud currently knows about.
`;

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const first = args[0];

  if (first === "-v" || first === "--version" || first === "version") {
    console.log(VERSION);
    return 0;
  }

  if (!first || first === "-h" || first === "--help" || first === "help") {
    console.log(HELP);
    return 0;
  }

  if (first === "formats") {
    const found = await loadFormats();
    console.log(`\n  Adapters discovered in src/formats/ (canonical schema v${CANONICAL_SCHEMA_VERSION}):`);
    if (found.length === 0) {
      console.log("    (none yet)");
    } else {
      for (const a of found) console.log(`    - ${a.id.padEnd(12)} writes .${a.outputExtensions.join(", .").padEnd(6)} ${a.label}`);
    }
    console.log(`\n  Drop a folder into src/formats/ to add one (copy src/formats/_template).\n`);
    return 0;
  }

  if (first === "inspect") {
    const path = args[1];
    if (!path) {
      console.log(`\n  Usage: vaud inspect <file>\n`);
      return 1;
    }
    await loadFormats();
    const input = await readInput(path);
    const src = registry.detect(input);
    if (!src) {
      console.log(`\n  vaud does not recognize "${path}".`);
      console.log(`  Known formats: ${registry.all().map((a) => a.id).join(", ")}\n`);
      return 1;
    }
    const ent = src.toCanonical(input);
    console.log(`\n  ${path}`);
    console.log(`    format   ${src.id}  (${src.label})`);
    console.log(`    kind     ${ent.kind}`);
    if (ent.kind === "lorebook") {
      const b = ent.body;
      console.log(`    name     ${b.name || "(unnamed)"}`);
      console.log(`    type     ${b.lorebookType ?? "(none)"}`);
      console.log(`    entries  ${b.entries.length}`);
      console.log(`    budget   ${b.tokenBudget} (${b.budgetMode})\n`);
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
      console.log(`\n  Usage: vaud label <file>\n`);
      return 1;
    }
    await loadFormats();
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
    const [, inPath, outPath, ...rest] = args;
    if (!inPath || !outPath) {
      console.log(`\n  Usage: vaud convert <in> <out> [--to <format>]\n`);
      return 1;
    }
    const toFlag = rest.indexOf("--to");
    const forcedTarget = toFlag >= 0 ? rest[toFlag + 1] : undefined;

    await loadFormats();
    const input = await readInput(inPath);
    const src = registry.detect(input);
    if (!src) {
      console.log(`\n  vaud does not recognize "${inPath}".`);
      console.log(`  Known formats: ${registry.all().map((a) => a.id).join(", ")}\n`);
      return 1;
    }

    const target = resolveTarget(forcedTarget, outPath);
    if (!target.ok) {
      console.log(`\n  ${target.error}`);
      console.log(`  Pass one explicitly: vaud convert ${inPath} ${outPath} --to <format>`);
      console.log(`  Known formats: ${registry.all().map((a) => a.id).join(", ")}\n`);
      return 1;
    }

    const { out, lorebooks } = convertFile(src, target.adapter, input);
    await writeOutput(outPath, out);
    console.log(`\n  ${src.id} -> ${target.adapter!.id}`);
    console.log(`  ${inPath}  ->  ${outPath}`);
    if (lorebooks.length > 0) {
      const total = lorebooks.reduce((n, l) => n + l.body.entries.length, 0);
      console.log(`  + embedded lorebook carried across (${total} entr${total === 1 ? "y" : "ies"})`);
    }
    console.log("");
    return 0;
  }

  console.log(`\n  Unknown command: ${first}`);
  console.log(`  Run "vaud help" to see what is available.\n`);
  return 1;
}

process.exit(await main(process.argv));
