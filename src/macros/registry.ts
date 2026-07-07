// ============================================================================
// MACRO REGISTRY
// Central registry for all macro definitions
// ============================================================================

import { MacroDefinition, MacroHandler, MacroCategory } from './types';

/**
 * Global registry of all registered macros.
 * Key is the definition's original name (preserving case), so that
 * capitalized variants such as {{They}}/{{Them}}/{{Their}} live alongside
 * their lowercase counterparts without collision.
 */
const macroRegistry = new Map<string, MacroDefinition>();

/**
 * Alias map for quick lookup
 * Key is alias (lowercase), value is canonical macro name (original case)
 */
const aliasMap = new Map<string, string>();

/**
 * Register a macro with the system.
 *
 * Idempotent on the handler: if a macro with the same name (case-insensitive
 * for purely-lowercase names, exact for mixed-case) is already registered,
 * the handler registration is skipped.  However, aliases on the incoming
 * definition are always processed so that a later file can contribute
 * additional aliases for an already-registered canonical name (e.g.
 * character.ts adds "greeting" for the "firstmessage" that scene.ts already
 * owns).
 */
export function registerMacro(definition: MacroDefinition): void {
  // Determine the storage key.  Mixed-case names (e.g. "They", "Them",
  // "Their") are stored under their original case so they remain distinct
  // from the lowercase equivalents.  Purely-lowercase names use their own
  // value as the key (no change in behaviour).
  const key = definition.name;
  const keyLower = key.toLowerCase();

  // Idempotent on handler: skip if an exact-case OR lowercase collision exists.
  // A lowercase collision means (for example) "they" is already registered and
  // someone is trying to add another "they" — skip the handler but still
  // register aliases below.
  const alreadyRegistered = macroRegistry.has(key) || macroRegistry.has(keyLower);

  if (!alreadyRegistered) {
    macroRegistry.set(key, definition);
  }

  // Determine the canonical name to store in aliasMap.  If we just registered
  // the entry, use our key.  If we hit an existing registration, point aliases
  // at the original registrant's key so getMacro resolves correctly.
  const canonicalKey = macroRegistry.has(key) ? key : keyLower;

  // Register aliases.  First-wins is intentional for aliases too, but when a
  // duplicate handler is skipped we still process aliases so that the later
  // definition can contribute aliases not present on the earlier one (e.g.
  // "greeting" for "firstmessage").
  if (definition.aliases) {
    for (const alias of definition.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasMap.has(aliasLower)) {
        // First-wins is intentional: some macros share canonical aliases
        // (e.g. "maxcontext" → "tokenbudget" wins over a later "maxprompt"
        // registration). Route to stdout so this expected first-wins log
        // stops showing up as [err] on every container boot.
        console.log(
          `Alias "${aliasLower}" is already mapped to "${aliasMap.get(aliasLower)}", skipping for "${canonicalKey}"`
        );
        continue;
      }
      aliasMap.set(aliasLower, canonicalKey);
    }
  }
}

/**
 * Register multiple macros at once
 */
export function registerMacros(definitions: MacroDefinition[]): void {
  for (const def of definitions) {
    registerMacro(def);
  }
}

/**
 * Built-in nondeterministic macro families. Random output or wall-clock
 * dependence means a template containing any of these can't have its
 * evaluation result cached. Checked by canonical name (aliases resolve via
 * getMacro first); individual definitions can also opt in via `volatile`.
 */
const BUILTIN_VOLATILE_MACROS = new Set([
  // random family
  'random', 'pick', 'roll', 'dice', 'range', 'coinflip', 'percent', 'shuffle', 'weighted',
  // time family (wall-clock dependent)
  'time', 'date', 'weekday', 'isodate', 'isotime', 'idle_duration',
  'season', 'moonphase', 'zodiac', 'year', 'month', 'day', 'datetimeformat', 'timediff',
]);

/** Is this macro (by name or alias) nondeterministic? */
export function isVolatileMacro(nameOrAlias: string): boolean {
  const def = getMacro(nameOrAlias);
  if (def?.volatile) return true;
  return BUILTIN_VOLATILE_MACROS.has(def?.name ?? nameOrAlias.toLowerCase());
}

/**
 * Get a macro definition by name or alias.
 *
 * Lookup order:
 *   1. Exact-case match in macroRegistry (required for mixed-case names like
 *      "They" that are distinct from their lowercase counterpart "they").
 *   2. Lowercase match in macroRegistry (the common path for all-lowercase names).
 *   3. Alias map lookup (lowercase alias → canonical key → macroRegistry).
 */
export function getMacro(nameOrAlias: string): MacroDefinition | undefined {
  // 1. Exact-case lookup (handles "They", "Them", "Their" etc.)
  const exact = macroRegistry.get(nameOrAlias);
  if (exact) return exact;

  // 2. Lowercase lookup (handles the normal all-lowercase case)
  const lower = nameOrAlias.toLowerCase();
  const direct = macroRegistry.get(lower);
  if (direct) return direct;

  // 3. Alias lookup
  const canonical = aliasMap.get(lower);
  if (canonical) {
    return macroRegistry.get(canonical);
  }

  return undefined;
}

/**
 * Get the handler for a macro
 */
export function getMacroHandler(nameOrAlias: string): MacroHandler | undefined {
  const macro = getMacro(nameOrAlias);
  return macro?.handler;
}

/**
 * Check if a macro is registered
 */
export function hasMacro(nameOrAlias: string): boolean {
  return getMacro(nameOrAlias) !== undefined;
}

/**
 * Get all registered macros
 */
export function getAllMacros(): MacroDefinition[] {
  return Array.from(macroRegistry.values());
}

/**
 * Get macros by category
 */
export function getMacrosByCategory(category: MacroCategory): MacroDefinition[] {
  return Array.from(macroRegistry.values()).filter(m => m.category === category);
}

/**
 * Clear all registered macros (mainly for testing)
 */
export function clearRegistry(): void {
  macroRegistry.clear();
  aliasMap.clear();
}

/**
 * Get registry stats
 */
export function getRegistryStats(): {
  totalMacros: number;
  totalAliases: number;
  byCategory: Record<MacroCategory, number>;
} {
  const byCategory: Record<MacroCategory, number> = {
    identity: 0,
    time: 0,
    random: 0,
    chat: 0,
    variables: 0,
    conditional: 0,
    text: 0,
    lorebook: 0,
    pronouns: 0,
    preset: 0,
  };

  for (const macro of macroRegistry.values()) {
    byCategory[macro.category]++;
  }

  return {
    totalMacros: macroRegistry.size,
    totalAliases: aliasMap.size,
    byCategory,
  };
}
