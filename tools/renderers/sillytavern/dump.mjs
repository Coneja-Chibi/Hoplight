#!/usr/bin/env node
/**
 * Ask SillyTavern's macro engine what macros it has, and print them as JSON on stdout.
 *
 * THE SAME PRINCIPLE AS THE RENDERER, one question earlier. render.mjs asks the engine what a preset
 * resolves to; this asks it what it can resolve at all. Both load the real install through
 * stage.mjs rather than reading source with a regex, and for the same reason: a scraper over
 * someone else's code misses forms silently, and a macro catalog that is quietly missing entries
 * reports them as macros the engine does not have.
 *
 * WHAT MAKES THIS POSSIBLE HERE. SillyTavern registers every macro into a real registry -
 * MacroRegistry.registerMacro(name, { category, aliases, unnamedArgs, description, exampleUsage })
 * - and exposes getAllMacros(). Those are the OPTIONS; the built definition renames unnamedArgs to
 * unnamedArgDefs, which is what this reads back off it. The legacy MacrosParser.registerMacro path is deprecated and forwards
 * into the same registry, so there is one source of truth and nothing is left behind by reading it.
 *
 * RUN ONCE, BY A PERSON. Staging writes into the user's own checkout while it works. The OUTPUT is
 * what ships; see scripts/sillytavern-macros.ts.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  engineVersion,
  fail,
  HERE,
  installBrowserGlobals,
  resolveRoot,
  stageEngine,
} from "./stage.mjs";

const stRoot = resolveRoot();
const { entry, cleanup } = stageEngine(stRoot, "dump");

installBrowserGlobals();

/**
 * The variable store, before registration rather than before evaluation.
 *
 * REGISTRATION ITSELF READS IT. `registerVariableMacros` calls `SillyTavern.getContext()` at module
 * scope while declaring what it declares, so an engine loaded without the context throws before a
 * single macro exists - the registry is not a passive table that can be read cold. The renderer
 * installs this for a different reason (getvar must actually resolve); here it is simply what makes
 * the engine load at all.
 */
const { installContext } = await import(pathToFileURL(join(HERE, "context.mjs")).href);
installContext();

const engine = await import(entry).catch((e) => fail(`could not load the macro engine: ${e.message}`));
if (typeof engine.initRegisterMacros === "function") engine.initRegisterMacros();

const registry = engine.macros?.registry;
if (!registry || typeof registry.getAllMacros !== "function") {
  fail("this SillyTavern build does not expose macros.registry.getAllMacros");
}

/**
 * Aliases are asked for EXPLICITLY, then folded into the macro they alias.
 *
 * getAllMacros returns alias entries as first-class rows by default. Emitting them as separate
 * macros would inflate the catalog with duplicates of the same behaviour; dropping them would warn
 * on perfectly valid text, since somebody reading another author's preset meets whichever spelling
 * that author chose. MacroEntry.aliases is the model this repo already uses for exactly this.
 */
const all = registry.getAllMacros({ excludeAliases: true }) ?? [];
if (all.length === 0) fail("the registry answered with no macros at all");

/**
 * Aliases are read from their OWN ROWS, which point back with `aliasOf`.
 *
 * The definition object also carries an `aliases` array - populated on 29 of the 93 entries, holding
 * `{ alias, visible }` objects rather than strings. Either source can be made to work; this one is
 * used because it is the same shape for every macro and needs no per-entry unwrapping.
 *
 * WHAT DOES NOT WORK is reading `aliases` as an array of STRINGS, which is what this first did: it
 * exits zero and yields a catalog with no aliases at all, so an engine that resolves `{{bot}}` has
 * `{{bot}}` reported as a macro it does not have. The full listing is 124 rows against 93 macros,
 * and that difference is exactly the aliases.
 */
const aliasesFor = new Map();
for (const def of registry.getAllMacros() ?? []) {
  const parent = def?.aliasOf;
  if (typeof parent !== "string" || !parent || parent === def.name) continue;
  const list = aliasesFor.get(parent) ?? [];
  if (def.name && !list.includes(def.name)) list.push(def.name);
  aliasesFor.set(parent, list);
}

/**
 * Field names read off a real definition, not guessed - the first attempt used `unnamedArgs` and
 * `examples`, which do not exist, and every macro came back with no arguments and no examples while
 * exiting zero. A dumper that silently produces empty fields is how a catalog loses its forms.
 */
const out = all.map((def) => {
  const name = def.name ?? "";
  const unnamed = Array.isArray(def.unnamedArgDefs) ? def.unnamedArgDefs : [];
  return {
    name,
    description: typeof def.description === "string" ? def.description : "",
    category: typeof def.category === "string" ? def.category : "",
    aliases: aliasesFor.get(name) ?? [],
    minArgs: typeof def.minArgs === "number" ? def.minArgs : 0,
    maxArgs: typeof def.maxArgs === "number" ? def.maxArgs : 0,
    args: unnamed.map((a) => ({
      name: a?.name ?? "",
      optional: a?.optional === true,
      sample: typeof a?.sampleValue === "string" ? a.sampleValue : "",
    })),
    /**
     * The engine's OWN spelling of itself, and the most valuable field here. Our hand-written
     * SillyTavern catalog records `{{roll:1d6}}`; the registry says `{{roll::1d20}}`. Separators are
     * exactly where a name-level catalog goes wrong, so where the engine states a form we take it
     * rather than rebuilding one from argument names.
     */
    exampleUsage: (def.exampleUsage ?? []).filter((e) => typeof e === "string" && e),
    returns: typeof def.returns === "string" ? def.returns : "",
    /** Which file registered it, so an extension-provided macro is not reported as core. */
    source: def.source?.name ?? "",
    isExtension: def.source?.isExtension === true,
  };
});

process.stdout.write(JSON.stringify({
  engine: { name: "sillytavern", version: engineVersion(stRoot) },
  macros: out,
}));
cleanup();
