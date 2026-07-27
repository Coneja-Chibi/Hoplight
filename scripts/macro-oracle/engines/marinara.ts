/**
 * Marinara extractor. Unlike RoleCall and Lumiverse there is no runtime registry to interrogate:
 * the engine exports a flat `SUPPORTED_MACROS` array of `{ category, syntax, description }`, so the
 * capture reads that export and derives each name from its documented syntax.
 *
 * Aliasing is expressed in prose upstream ("Alias for {{user}}"), not as data, so nothing here can
 * honestly claim to know Marinara's alias graph. Aliases are captured as empty rather than guessed
 * from description text, and the parity check treats that as unknown rather than as none.
 */
import type { EngineMacroFact, MacroOracleEngine } from "../types";

interface MarinaraDefinition {
  category: string;
  syntax: string;
}

interface MarinaraModule {
  SUPPORTED_MACROS?: readonly MarinaraDefinition[];
}

/**
 * Every dispatch name a documented syntax string mentions.
 *
 * One entry can document several macros at once: "{{incvar::name}} / {{decvar::name}}",
 * "{{datetime}} / {{isotime}}", "{{trimStart}} / {{trimEnd}}". Reading only the leading token
 * silently loses the second half, and an undercounted capture reads as the catalog over-claiming
 * macros the engine really does have. Scan every brace group rather than parsing the first one.
 */
export function namesFromSyntax(syntax: string): string[] {
  return [...syntax.matchAll(/\{\{([^{}]*)\}\}/g)]
    .map((match) => (match[1] ?? "").trim().replace(/^[#/]/, ""))
    .map((inner) => (/^[A-Za-z_][A-Za-z0-9_.]*/.exec(inner)?.[0] ?? "").toLowerCase())
    .filter(Boolean);
}

const marinara: MacroOracleEngine = {
  id: "marinara",
  sourceEnvVar: "VAUD_MARINARA_MACRO_SRC",
  provenance:
    "Read the SUPPORTED_MACROS export of Marinara-Engine's packages/shared/src/utils/macro-engine.ts "
    + "and derived each name from its documented syntax. Names and category labels only; Marinara "
    + "expresses aliases in prose, so none are claimed here.",

  async extract(root: string): Promise<EngineMacroFact[]> {
    const entry =
      `${root.replaceAll("\\", "/")}/packages/shared/src/utils/macro-engine.ts`;
    const mod = (await import(entry)) as MarinaraModule;
    const supported = mod.SUPPORTED_MACROS;
    if (!Array.isArray(supported) || supported.length === 0) {
      throw new Error(`marinara: ${entry} exports no non-empty SUPPORTED_MACROS; the checkout shape changed`);
    }

    // Several syntaxes can share one dispatch name ({{roll}} and {{roll::1d6}}); fold them.
    const byName = new Map<string, EngineMacroFact>();
    for (const definition of supported) {
      for (const name of namesFromSyntax(definition.syntax)) {
        if (byName.has(name)) continue;
        byName.set(name, {
          name,
          aliases: [],
          ...(definition.category ? { category: definition.category } : {}),
        });
      }
    }
    return [...byName.values()];
  },
};

export default marinara;
