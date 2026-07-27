/**
 * RoleCall extractor. Its registry starts empty and is filled by roughly two dozen separate
 * `register<Family>Macros()` calls rather than one init, so the capture calls every registrar the
 * module exports. That is deliberately discovered by name pattern instead of hardcoded: a new macro
 * family added upstream should show up in the next capture without editing this file.
 *
 * Registration is noisy on purpose upstream. It logs when two families claim the same alias and
 * keeps the first. Those collisions are real facts about the engine and are preserved as captured,
 * not silently deduped into something tidier than the engine actually is.
 */
import type { EngineMacroFact, MacroOracleEngine } from "../types";

interface RcDefinition {
  name: string;
  aliases?: string[];
  category?: string;
}

type RcMacroModule = Record<string, unknown> & {
  getAllMacros?: () => RcDefinition[];
  clearRegistry?: () => void;
};

const IS_REGISTRAR = /^register[A-Z][A-Za-z]*Macros$/;

const rolecall: MacroOracleEngine = {
  id: "rolecall",
  sourceEnvVar: "VAUD_RC_MACRO_SRC",
  provenance:
    "Called every register<Family>Macros() export of RoleCall's apps/rc/src/lib/macros and read "
    + "getAllMacros(). Names, aliases and category labels only.",

  async extract(root: string): Promise<EngineMacroFact[]> {
    const entry = `${root.replaceAll("\\", "/")}/apps/rc/src/lib/macros/index.ts`;
    const mod = (await import(entry)) as RcMacroModule;
    if (typeof mod.getAllMacros !== "function") {
      throw new Error(`rolecall: ${entry} exports no getAllMacros(); the checkout shape changed`);
    }
    mod.clearRegistry?.();

    const registrars = Object.keys(mod).filter((key) => IS_REGISTRAR.test(key));
    if (registrars.length === 0) {
      throw new Error("rolecall: no register<Family>Macros exports found; the checkout shape changed");
    }
    for (const key of registrars) {
      const register = mod[key];
      if (typeof register === "function") (register as () => void)();
    }

    const definitions = mod.getAllMacros();
    if (definitions.length === 0) {
      throw new Error("rolecall: registry is empty after registration; refusing to write an empty capture");
    }
    return definitions.map((definition) => ({
      name: definition.name,
      aliases: definition.aliases ?? [],
      ...(definition.category ? { category: definition.category } : {}),
    }));
  },
};

export default rolecall;
