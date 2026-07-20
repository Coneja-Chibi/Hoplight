/**
 * Browser shell for regex execution: posts value-only work to the sandbox-origin worker and
 * terminates the worker at a hard wall-clock deadline or when a superseding preview aborts.
 */
import type { RegexRunOptions, RegexRunResult } from "../../../../core/regex";
import type { RegexRule } from "../../../../entities/regex/schema";

const HARD_TIMEOUT_MS = 750;
let runSequence = 0;

export type RegexSandboxResult =
  | { ok: true; result: RegexRunResult }
  | { ok: false; reason: "timeout" | "cancelled" | "error"; error: string };

export interface RegexSandboxOptions extends Omit<RegexRunOptions, "now"> {
  signal?: AbortSignal;
  hardTimeoutMs?: number;
  /** Test seam for proving termination without starting a real browser worker. */
  workerFactory?: () => Worker;
}

const workerHref = (): string => {
  if (typeof document !== "undefined") {
    const origin = document.querySelector('meta[name="vaude-sandbox-origin"]')?.getAttribute("content")?.trim();
    if (origin?.startsWith("http://127.0.0.1:")) return `${origin.replace(/\/$/, "")}/sandbox/regex-worker.js`;
    return "/sandbox/regex-worker.js";
  }
  return new URL("../../../../sandbox/regex/worker.ts", import.meta.url).href;
};

/** Execute a rule set outside the UI thread. This function never throws. */
export function runRegexSandboxed(
  text: string,
  rules: readonly RegexRule[],
  options: RegexSandboxOptions,
): Promise<RegexSandboxResult> {
  const runId = ++runSequence;
  const deadline = Math.max(1, Math.min(options.hardTimeoutMs ?? HARD_TIMEOUT_MS, HARD_TIMEOUT_MS));
  const { signal, hardTimeoutMs: _hardTimeoutMs, workerFactory, ...wireOptions } = options;
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = workerFactory?.() ?? new Worker(workerHref(), { type: "module" });
    } catch (error) {
      resolve({
        ok: false,
        reason: "error",
        error: `regex worker failed to start: ${error instanceof Error ? error.message : String(error)}`,
      });
      return;
    }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: RegexSandboxResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      resolve(result);
    };
    const abort = (): void => finish({ ok: false, reason: "cancelled", error: "regex preview cancelled" });
    timer = setTimeout(
      () => finish({ ok: false, reason: "timeout", error: `regex worker exceeded ${deadline}ms` }),
      deadline,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const data = event.data as { runId?: unknown; ok?: unknown; result?: unknown; error?: unknown };
      if (data.runId !== runId) return;
      if (data.ok === true && data.result && typeof data.result === "object") {
        finish({ ok: true, result: data.result as RegexRunResult });
      } else {
        finish({ ok: false, reason: "error", error: typeof data.error === "string" ? data.error : "regex worker failed" });
      }
    });
    worker.addEventListener("error", () =>
      finish({ ok: false, reason: "error", error: "regex worker failed to load" }));
    try {
      worker.postMessage({ runId, text, rules, options: wireOptions });
    } catch (error) {
      finish({
        ok: false,
        reason: "error",
        error: `regex worker rejected the request: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });
}
