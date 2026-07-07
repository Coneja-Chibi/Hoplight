/**
 * Hardened wasmoon (PUC-Lua 5.4) engine - the Lua layer of the card sandbox. Standard libraries are
 * OPT-IN: we open none by default and load only the pure/safe set (base, table, string, math, coroutine,
 * utf8), never io / os / debug / package, so a card cannot reach the host filesystem, shell, or the
 * package loader. The base library still ships load / loadfile / dofile (bytecode + file reach), so those
 * are stripped too - source strings only, never untrusted bytecode. Host capabilities are injected as Lua
 * globals; anything not injected simply does not exist in the card's world (deny-by-absence).
 *
 * Grounded in design/SANDBOX-RESEARCH-2026-07.md (wasmoon 1.16.0, pinned; vendoring is a later step).
 * This is the in-VM tier only; a Worker backstop against blocked host calls is a later phase.
 */
import { LuaFactory, LuaLibraries, type LuaEngine } from "wasmoon";

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
  /** wall-clock cap in ms; a pure-Lua infinite loop aborts with LuaTimeoutError past this. */
  timeoutMs?: number;
  /** hard ceiling on VM memory in bytes; allocation past it fails INSIDE the VM, never the host. */
  memoryMaxBytes?: number;
  /** host functions exposed as Lua globals. Absent names do not exist in the card (deny-by-absence). */
  capabilities?: Record<string, Capability>;
}

const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_MEMORY_MAX = 64 * 1024 * 1024; // 64 MiB

/**
 * Build a FRESH hardened Lua engine (a fresh instance per run - wasmoon's async :await memory bugs
 * cluster on singleton reuse). The caller MUST close it; runLua() does so in a finally.
 */
export async function createHardenedLua(opts: HardenedLuaOptions = {}): Promise<LuaEngine> {
  const factory = new LuaFactory();
  const engine = await factory.createEngine({
    openStandardLibs: false, // deny-by-absence: only SAFE_LIBS below are opened
    injectObjects: false,
    functionTimeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    traceAllocations: true, // required for setMemoryMax (the VM memory ceiling / DoS cap)
  });
  for (const lib of SAFE_LIBS) engine.global.loadLibrary(lib);
  // strip the host-reaching / bytecode-loading base globals the base lib brought in
  engine.global.set("__strip", STRIPPED_GLOBALS);
  engine.doStringSync("for _, n in ipairs(__strip) do _G[n] = nil end __strip = nil");
  engine.global.setMemoryMax(opts.memoryMaxBytes ?? DEFAULT_MEMORY_MAX);
  for (const [name, fn] of Object.entries(opts.capabilities ?? {})) engine.global.set(name, fn);
  return engine;
}
