/**
 * Dedicated regex execution worker. It accepts value-only requests, applies the existing core
 * engine, and has no API token, DOM, storage, filesystem, or network bridge.
 */
import { applyRules, type RegexRunOptions } from "../../core/regex";
import type { RegexRule } from "../../entities/regex/schema";

const MAX_TEXT_CHARS = 200_000;
const MAX_RULES = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validRule(value: unknown): value is RegexRule {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.label === "string" &&
    typeof value.find === "string" && typeof value.replace === "string" &&
    typeof value.flags === "string" && Array.isArray(value.phases) &&
    value.phases.every((phase) => typeof phase === "string") &&
    typeof value.enabled === "boolean" && typeof value.sortOrder === "number";
}

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isRecord(request) || typeof request.runId !== "number" ||
      typeof request.text !== "string" || request.text.length > MAX_TEXT_CHARS ||
      !Array.isArray(request.rules) || request.rules.length > MAX_RULES ||
      !request.rules.every(validRule) || !isRecord(request.options) ||
      typeof request.options.phase !== "string") {
    self.postMessage({ runId: isRecord(request) ? request.runId : -1, ok: false, error: "regex-worker: invalid request" });
    return;
  }
  try {
    const options = request.options as unknown as RegexRunOptions;
    const result = applyRules(request.text, request.rules, options);
    self.postMessage({ runId: request.runId, ok: true, result });
  } catch (error) {
    self.postMessage({
      runId: request.runId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
