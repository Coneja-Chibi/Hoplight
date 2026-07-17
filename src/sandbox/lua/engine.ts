/**
 * Hardened wasmoon (PUC-Lua 5.4) engine - the Lua layer of the card sandbox. Standard libraries are
 * OPT-IN: we open none by default and load only the pure/safe set (base, table, string, math, coroutine,
 * utf8), never io / os / debug / package. Bytecode/file loaders are stripped. Host capabilities are
 * injected as Lua globals; anything not injected does not exist (deny-by-absence).
 *
 * Browser: pass wasmUri (or rely on default /sandbox/glue.wasm when a document exists) so the factory
 * can fetch glue.wasm from the UI server. Bun/Node: default factory resolution is fine.
 */
import { LuaFactory, LuaLibraries, type LuaEngine } from "wasmoon";
import { resolveLuaRunLimits } from "./limits";

/** the pure standard libraries a card may use - deliberately no io / os / debug / package. */
export const SAFE_LIBS: readonly LuaLibraries[] = [
  LuaLibraries.Base,
  LuaLibraries.Table,
  LuaLibraries.String,
  LuaLibraries.Math,
  LuaLibraries.Coroutine,
  LuaLibraries.UTF8,
];

/** base-library globals that reach the host or load bytecode - removed after the libs open. */
const STRIPPED_GLOBALS: readonly string[] = ["load", "loadfile", "dofile", "loadstring", "require", "collectgarbage"];

/** one host function exposed to the card. Args arrive already decoded from Lua. */
export type Capability = (...args: unknown[]) => unknown;

export interface HardenedLuaOptions {
  /** wall-clock cap in ms; clamped to release max. A pure-Lua infinite loop aborts with LuaTimeoutError. */
  timeoutMs?: number;
  /** hard ceiling on VM memory in bytes; clamped to release max. */
  memoryMaxBytes?: number;
  /** host functions exposed as Lua globals. Absent names do not exist in the card (deny-by-absence). */
  capabilities?: Record<string, Capability>;
  /**
   * Where to fetch glue.wasm. Browser default: "/sandbox/glue.wasm" (served by the UI server).
   * Bun/Node: omit to use wasmoon's built-in resolution.
   */
  wasmUri?: string;
}

const isBrowser = (): boolean =>
  typeof globalThis !== "undefined" &&
  typeof (globalThis as { document?: unknown }).document !== "undefined";

/** Prefer the worker/window origin so a distinct sandbox host serves glue.wasm (ADR-009). */
const defaultWasmUri = (): string | undefined => {
  try {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin && /^https?:\/\//.test(loc.origin)) {
      return `${loc.origin}/sandbox/glue.wasm`;
    }
  } catch {
    /* ignore */
  }
  if (isBrowser()) return "/sandbox/glue.wasm";
  return undefined;
};

/**
 * Build a FRESH hardened Lua engine (a fresh instance per run - wasmoon's async :await memory bugs
 * cluster on singleton reuse). The caller MUST close it; runLua() does so in a finally.
 * timeout/memory are clamped through resolveLuaRunLimits so callers cannot exceed release ceilings.
 */
export async function createHardenedLua(opts: HardenedLuaOptions = {}): Promise<LuaEngine> {
  const limits = resolveLuaRunLimits({
    timeoutMs: opts.timeoutMs,
    memoryMaxBytes: opts.memoryMaxBytes,
  });
  const wasmUri = opts.wasmUri ?? defaultWasmUri();
  const factory = wasmUri !== undefined ? new LuaFactory(wasmUri) : new LuaFactory();
  const engine = await factory.createEngine({
    openStandardLibs: false, // deny-by-absence: only SAFE_LIBS below are opened
    injectObjects: false,
    functionTimeout: limits.timeoutMs,
    traceAllocations: true, // required for setMemoryMax (the VM memory ceiling / DoS cap)
  });
  for (const lib of SAFE_LIBS) engine.global.loadLibrary(lib);
  // strip the host-reaching / bytecode-loading base globals the base lib brought in
  engine.global.set("__strip", STRIPPED_GLOBALS);
  engine.doStringSync("for _, n in ipairs(__strip) do _G[n] = nil end __strip = nil");
  engine.global.setMemoryMax(limits.memoryMaxBytes);
  for (const [name, fn] of Object.entries(opts.capabilities ?? {})) engine.global.set(name, fn);
  return engine;
}
