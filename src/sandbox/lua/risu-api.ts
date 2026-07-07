/**
 * Clean-room host API for Risu Lua cards: our own implementations of the public shim names a Risu card
 * calls (getChatVar/setChatVar and their getvar/setvar sugar, plus log), built over a plain state object
 * rather than a live app. Behavior mirrors the documented public contract only; none of Risu's (AGPL)
 * internals are reproduced here.
 *
 * State is mutated in place so the caller reads results after the card runs. Args are coerced defensively
 * because Lua hands host functions whatever the card passed (numbers, nil, booleans), not just strings.
 */
import type { Capability } from "./engine";

export interface RisuState {
  chatVars: Record<string, string>;
  log: string[];
}

/** Coerce a Lua-passed arg to a string; nil/undefined becomes "" so a var read/write never yields junk. */
const asString = (v: unknown): string => (v == null ? "" : String(v));

/** Build the card-facing globals over the given state. The state is mutated in place. */
export function createRisuApi(state: RisuState): { globals: Record<string, Capability> } {
  // Object.hasOwn, not `?? ""`: a bare index would leak inherited prototype members (getChatVar("toString")
  // -> a function, "__proto__" -> userdata) into the untrusted card and break the string return type.
  const getChatVar: Capability = (...args: unknown[]): string => {
    const key = asString(args[0]);
    return Object.hasOwn(state.chatVars, key) ? state.chatVars[key]! : "";
  };

  const setChatVar: Capability = (...args: unknown[]): void => {
    state.chatVars[asString(args[0])] = asString(args[1]);
  };

  const log: Capability = (...args: unknown[]): void => {
    state.log.push(asString(args[0]));
  };

  return {
    globals: {
      getChatVar,
      setChatVar,
      getvar: getChatVar,
      setvar: setChatVar,
      log,
    },
  };
}
