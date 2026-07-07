/**
 * Worker entry: runs ONE untrusted Risu card script (Lua) on its own thread with the card-facing host API
 * and json available, then posts back the result + the mutated variable state. Living off the host thread
 * is what makes the card killable - a runaway loop or wasm fault is stopped with worker.terminate() from
 * the parent (run-in-worker.ts), which the in-VM timeout cannot do.
 *
 * Capabilities cannot cross the worker boundary as functions, so state crosses instead: the parent passes
 * the initial chatVars in, this worker builds the host API over a LOCAL copy, runs the card, and posts the
 * mutated chatVars + log back. That keeps the kill switch AND gives cards their get/setChatVar + json.
 */
import { runLua, type LuaRunResult } from "./run";
import { createRisuApi, type RisuState } from "./risu-api";
import { jsonGlobals } from "./lua-json";

interface WorkerRequest {
  code: string;
  chatVars?: Record<string, string>;
  memoryMaxBytes?: number;
}

export interface WorkerResponse {
  result: LuaRunResult;
  chatVars: Record<string, string>;
  log: string[];
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

ctx.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  const { code, chatVars = {}, memoryMaxBytes } = e.data;
  const state: RisuState = { chatVars: { ...chatVars }, log: [] };
  const capabilities = { ...createRisuApi(state).globals, ...jsonGlobals() };
  void runLua(code, { capabilities, memoryMaxBytes }).then((result) =>
    ctx.postMessage({ result, chatVars: state.chatVars, log: state.log }),
  );
};
