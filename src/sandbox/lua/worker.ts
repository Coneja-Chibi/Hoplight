/**
 * Worker entry: runs ONE untrusted Lua card script on its own thread and posts the Result back. Living
 * off the host thread is what makes the card killable - a runaway loop or a wasm fault is stopped with
 * worker.terminate() from the parent (run-in-worker.ts), which the in-VM timeout cannot do. Capabilities
 * are not passed here yet (functions do not cross the worker boundary); the narrow host bridge is a later
 * phase. This worker runs pure, hardened Lua only.
 */
import { runLua } from "./run";

interface WorkerRequest {
  code: string;
  memoryMaxBytes?: number;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  const { code, memoryMaxBytes } = e.data;
  void runLua(code, { memoryMaxBytes }).then((result) => ctx.postMessage(result));
};
