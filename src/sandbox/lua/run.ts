/**
 * Run one untrusted Lua card script in a fresh hardened engine and return a Result (never throws for a
 * card fault - a card crashing or looping is expected input, not a broken invariant). The engine is
 * closed in finally, win or lose. A pure-Lua infinite loop surfaces as reason "timeout".
 *
 * Boundary note: the timeout interrupts pure Lua. A card blocked INSIDE a host capability (an await that
 * never resolves) is not unstuck here - the Worker backstop (a later phase) kills that. This module is
 * the in-VM tier: it proves the engine is hardened, not that a hostile host-call can be terminated.
 */
import { LuaTimeoutError, type LuaEngine } from "wasmoon";
import { createHardenedLua, type HardenedLuaOptions } from "./engine";

export type LuaRunResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "timeout" | "error"; message: string };

/** Run untrusted Lua source (text only) with the hardened engine + given capabilities. */
export async function runLua(code: string, opts: HardenedLuaOptions = {}): Promise<LuaRunResult> {
  let engine: LuaEngine | undefined;
  try {
    engine = await createHardenedLua(opts);
    const value = (await engine.doString(code)) as unknown;
    return { ok: true, value };
  } catch (err) {
    if (err instanceof LuaTimeoutError) return { ok: false, reason: "timeout", message: err.message };
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : String(err) };
  } finally {
    engine?.global.close();
  }
}
