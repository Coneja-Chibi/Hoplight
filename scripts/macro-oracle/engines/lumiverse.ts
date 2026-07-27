/**
 * Lumiverse extractor. Its macro layer is a real registry, so the honest capture is to run the
 * engine's own `initMacros()` and read `registry.getAllMacros()` rather than parse its source.
 *
 * Two facts about the shape, both learned the hard way and worth keeping written down:
 * aliases live in a SEPARATE `registry.aliases` map, not only on the definitions, so reading the
 * definitions alone undercounts them; and the registry is empty until `initMacros()` runs, so a
 * capture that forgets it reports zero macros and looks like a clean empty engine.
 *
 * Only names, aliases and category labels are read. The definitions also carry Lumiverse's own
 * description prose, which this deliberately never touches (see ../types.ts).
 */
import type { EngineMacroFact, MacroOracleEngine } from "../types";

interface LumiDefinition {
  name: string;
  aliases?: string[];
  category?: string;
}

interface LumiMacroModule {
  initMacros: () => void;
  registry: {
    getAllMacros: () => LumiDefinition[];
    aliases?: Map<string, string>;
  };
}

const lumiverse: MacroOracleEngine = {
  id: "lumiverse",
  sourceEnvVar: "VAUD_LUMI_MACRO_SRC",
  provenance:
    "Ran Lumiverse's own initMacros() and read MacroRegistry.getAllMacros() plus the registry alias "
    + "map, from src/macros in the checkout. Names, aliases and category labels only.",

  async extract(root: string): Promise<EngineMacroFact[]> {
    const entry = `${root.replaceAll("\\", "/")}/src/macros/index.ts`;
    const mod = (await import(entry)) as LumiMacroModule;
    if (typeof mod.initMacros !== "function") {
      throw new Error(`lumiverse: ${entry} exports no initMacros(); the checkout shape changed`);
    }
    mod.initMacros();
    const definitions = mod.registry.getAllMacros();
    if (definitions.length === 0) {
      throw new Error("lumiverse: registry is empty after initMacros(); refusing to write an empty capture");
    }

    // Fold the separate alias map back onto its primary, then union with any per-definition list.
    const extra = new Map<string, string[]>();
    for (const [alias, primary] of mod.registry.aliases ?? []) {
      extra.set(primary, [...(extra.get(primary) ?? []), alias]);
    }
    return definitions.map((definition) => ({
      name: definition.name,
      aliases: [...(definition.aliases ?? []), ...(extra.get(definition.name) ?? [])],
      ...(definition.category ? { category: definition.category } : {}),
    }));
  },
};

export default lumiverse;
