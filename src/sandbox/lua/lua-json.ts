/**
 * A minimal, whitelisted `require 'json'` for cards. The hardened engine strips the real require +
 * package loader (engine.ts), so cards that expect the ubiquitous RisuAI/SillyTavern `local json =
 * require 'json'` idiom would otherwise fail. This gives them a JSON codec and nothing else: require
 * resolves ONLY the name "json" and throws for every other module (deny-by-absence, no package reach).
 *
 * Mechanics: wasmoon is built here with injectObjects:false but enableProxy:true (its default), so a
 * plain JS object set as a global is pushed by reference as proxied userdata whose __index hands back
 * its function fields. That is why `json.encode` / `require('json').encode` resolve and call correctly
 * without copying the table into the VM. Lua table arguments are already decoded to JS arrays / objects
 * at the call boundary, so JSON.stringify / JSON.parse round-trip sequences and string-keyed maps.
 */
import type { Capability } from "./engine";

/** The codec table handed to cards. Kept as one shared reference so require and the global agree. */
interface JsonTable {
  encode: (value: unknown) => string;
  decode: (text: unknown) => unknown;
}

/** Serialize a Lua value (already decoded to a JS array / object / scalar) to a JSON string. */
const encode = (value: unknown): string => {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error("lua-json: cannot encode value (unsupported type)");
  return text;
};

/** Parse a JSON string back into a JS value; wasmoon pushes it into Lua as a table / scalar. */
const decode = (text: unknown): unknown => {
  if (typeof text !== "string") throw new Error("lua-json: decode expects a string");
  return JSON.parse(text) as unknown;
};

/**
 * Globals to inject so cards can use `require 'json'` and a bare `json` table. The table + loader are
 * built FRESH per call (not module-level singletons): wasmoon marshals the table by reference, so a card
 * could otherwise write through the proxy (`json.encode = ...`) and poison every later run in the process.
 * A per-run table keeps isolation intact - one card cannot leak into or break another. The json entry is
 * a table of functions, not a callable, so it is cast to Capability at this boundary; the engine sets it
 * as an opaque global value and wasmoon marshals it by reference.
 */
export function jsonGlobals(): Record<string, Capability> {
  const jsonTable: JsonTable = { encode, decode };
  const requireModule = (name: unknown): JsonTable => {
    if (name !== "json") throw new Error(`lua-json: module '${String(name)}' is not available`);
    return jsonTable;
  };
  return {
    require: requireModule as Capability,
    json: jsonTable as unknown as Capability,
  };
}
