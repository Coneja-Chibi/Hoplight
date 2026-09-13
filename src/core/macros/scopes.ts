/**
 * Variable scope resolution (specs/engine/macro-engine.md, scopes table).
 *
 * A bare key is session scope. A recognized `scope:` prefix routes to a namespaced storage key;
 * anything else with a colon is just a variable name that contains a colon (existing templates
 * rely on that, so unrecognized prefixes must stay literal). `character:` falls back to a literal
 * "unknown" namespace when the context has neither id nor name - reference behavior, kept.
 */
import type { MacroContext, MacroVariable } from "./types";

export type VariableScope = "session" | "character" | "arc" | "scene" | "global";

export interface ResolvedVariableTarget {
  scope: VariableScope;
  key: string;
  isGlobal: boolean;
}

export function resolveVariableTarget(
  rawKey: string,
  context: Pick<MacroContext, "characterId" | "characterName">,
): ResolvedVariableTarget {
  const colon = rawKey.indexOf(":");
  if (colon > 0) {
    const prefix = rawKey.slice(0, colon).toLowerCase();
    const rest = rawKey.slice(colon + 1);
    if (prefix === "session") return { scope: "session", key: rest, isGlobal: false };
    if (prefix === "character" || prefix === "char") {
      const ns = context.characterId || context.characterName || "unknown";
      return { scope: "character", key: `_char_${ns}_${rest}`, isGlobal: false };
    }
    if (prefix === "arc") return { scope: "arc", key: `_arc_${rest}`, isGlobal: false };
    if (prefix === "scene") return { scope: "scene", key: `_scene_${rest}`, isGlobal: false };
    if (prefix === "global") return { scope: "global", key: rest, isGlobal: true };
  }
  return { scope: "session", key: rawKey, isGlobal: false };
}

export const mapForTarget = (
  target: ResolvedVariableTarget,
  context: MacroContext,
): Map<string, MacroVariable> =>
  target.isGlobal ? context.globalVariables : context.localVariables;
