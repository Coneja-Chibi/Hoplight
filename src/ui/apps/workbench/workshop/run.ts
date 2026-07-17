/**
 * Pure-ish Test Bench run helpers for Workshop (data triggers + sealed module Lua).
 * UI stays thin; this file owns the result shaping.
 *
 * Browser-safe: never imports wasmoon / run.ts / engine. Module Lua always goes through the
 * killable worker (/sandbox/worker.js). Pulling wasmoon into the workbench app bundle breaks
 * GET /apps/workbench.js (Node "module" builtin in wasmoon's browser build).
 *
 * Resource policy: uses RELEASE_LUA_LIMITS via runLuaSandboxed (no 60s/256MiB override).
 */
import { runDataTriggers, type TriggerVars } from "../../../../sandbox/triggers/run-data-trigger";
import type { TriggerScript } from "../../../../entities/character/schema";
import { diffChatVars } from "../../../../sandbox/lua/risu-api";
import { seedRisuBench } from "../../../../sandbox/lua/risu-bench-seed";
import { runLuaSandboxed } from "../../../../sandbox/lua/run-in-worker";
import { stateFromWire } from "../../../../sandbox/lua/risu-state";
import { plainLuaError } from "./errors/plain-lua";

export type BenchLogLine = { cls: string; text: string };
export type BenchVarRow = { name: string; value: string };
export type BenchDelta = { name: string; before: string; after: string; moved: boolean };

export interface BenchRunResult {
  log: BenchLogLine[];
  delta: BenchDelta[];
  vars: BenchVarRow[];
}

/** Fire data-format triggers for one event against the console var rows. */
export function runDataBench(
  triggers: TriggerScript[],
  vars: BenchVarRow[],
  event: string,
  classes: { skip: string; fired: string; say: string },
): BenchRunResult {
  const varsMap: TriggerVars = {};
  for (const v of vars) if (v.name) varsMap[v.name] = v.value;
  const before = { ...varsMap };
  const result = runDataTriggers(triggers, varsMap, event);
  const log: BenchLogLine[] = [];
  if (result.fired.length === 0) log.push({ cls: classes.skip, text: "No rule fired for this event." });
  result.fired.forEach((f) => log.push({ cls: classes.fired, text: `> "${f}" fired` }));
  result.log.forEach((l) => log.push({ cls: classes.say, text: `  ${l}` }));
  const keys = new Set([...Object.keys(before), ...Object.keys(result.vars)]);
  const delta = [...keys].map((name) => ({
    name,
    before: before[name] ?? "",
    after: result.vars[name] ?? "",
    moved: before[name] !== result.vars[name],
  }));
  const nextVars = [...keys].map((name) => ({ name, value: result.vars[name] ?? "" }));
  return { log, delta, vars: nextVars };
}

export interface RunModuleBenchOpts {
  /** Canonical character body to seed name / description / first message / chat. */
  body?: unknown;
}

/** Load package triggerlua in the sealed room; returns log/delta/vars for the console. */
export async function runModuleBench(
  code: string,
  vars: BenchVarRow[],
  classes: { skip: string; fired: string; say: string },
  opts: RunModuleBenchOpts = {},
): Promise<BenchRunResult> {
  if (!code) {
    return { log: [{ cls: classes.skip, text: "No module Lua on this card." }], delta: [], vars };
  }
  const beforeRows = vars.map((v) => ({ name: v.name, value: v.value }));
  const beforeMap: Record<string, string> = {};
  for (const r of beforeRows) if (r.name) beforeMap[r.name] = r.value;

  const state = seedRisuBench({ vars: beforeRows, body: opts.body });
  // Always worker path in the UI - never wasmoon on the app main thread / workbench bundle.
  // Resource ceilings come from RELEASE_LUA_LIMITS inside runLuaSandboxed (no local override).
  const body = `${code}\nreturn type(KWU) == 'table' or type(getCampusId) == 'function' or true`;
  const boxed = await runLuaSandboxed(body, {
    state,
    withPrelude: true,
  });
  const after = stateFromWire(boxed.state);
  // Prefer worker-returned chatVars/log if state wire is partial
  if (Object.keys(after.chatVars).length === 0 && boxed.chatVars) {
    after.chatVars = { ...boxed.chatVars };
  }
  if (after.log.length === 0 && boxed.log.length > 0) {
    after.log = [...boxed.log];
  }

  const log: BenchLogLine[] = [];
  const result = boxed.result;
  if (result.ok) {
    log.push({
      cls: classes.fired,
      text: `> package scripts finished (sealed). chat bubbles: ${after.chat.length}. result: ${String(result.value)}`,
    });
  } else {
    const plain = plainLuaError(result.message, result.reason, result.limit);
    log.push({ cls: classes.skip, text: `> ${plain.plain}` });
    log.push({ cls: classes.say, text: `  technical: ${plain.technical}` });
  }
  for (const l of after.log.slice(0, 40)) {
    log.push({ cls: classes.say, text: `  ${l}` });
  }
  if (after.chat.length > 0) {
    const tail = after.chat.slice(-2);
    for (const m of tail) {
      log.push({ cls: classes.say, text: `  chat[${m.role}]: ${m.data.slice(0, 80)}` });
    }
  }

  const delta = diffChatVars(beforeMap, after.chatVars);
  const nextVars = [...new Set([...Object.keys(beforeMap), ...Object.keys(after.chatVars)])].map((name) => ({
    name,
    value: after.chatVars[name] ?? "",
  }));
  return { log, delta, vars: nextVars };
}
