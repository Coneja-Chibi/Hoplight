/**
 * Map sealed-room Lua errors to plain English for the Test Bench log.
 * Never claims more than the message supports; falls back to a shortened technical line.
 * Resource-limit failures are distinguished from card exceptions.
 */

export interface PlainLuaError {
  plain: string;
  technical: string;
}

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n)}…`;

const RESOURCE_PLAIN: Record<string, string> = {
  timeout: "Resource limit reached (time). The package scripts ran too long and were stopped.",
  "lua-memory": "Resource limit reached (Lua memory). The package scripts used too much VM memory.",
  "host-state": "Resource limit reached (host state). Scripts tried to store more data than the sealed room allows.",
  "message-count": "Resource limit reached (chat size). Too many or too-large chat messages.",
  "wire-size": "Resource limit reached (payload size). A request or response was too large.",
  "source-size": "Resource limit reached (script size). The package scripts are larger than the sealed room allows.",
  "chat-var": "Resource limit reached (variables). Too many or too-large chat variables.",
  log: "Resource limit reached (log). Scripts wrote more log lines than the sealed room allows.",
  meta: "Resource limit reached (card fields). A name/description field was too large.",
};

/**
 * Translate a wasmoon / sandbox failure message into creator-facing words.
 * `reason` is the run result reason; `limit` is the machine-readable resource category when present.
 */
export function plainLuaError(
  message: string,
  reason?: string,
  limit?: string,
): PlainLuaError {
  const technical = truncate(message.replace(/\s+/g, " ").trim(), 280);
  const m = technical.toLowerCase();

  if (reason === "resource" || limit) {
    const key = limit ?? "host-state";
    return {
      plain: RESOURCE_PLAIN[key] ?? `Resource limit reached (${key}).`,
      technical,
    };
  }

  if (reason === "timeout" || m.includes("deadline") || m.includes("timeout")) {
    return {
      plain: "The package scripts ran too long and were stopped (time limit in the sealed room).",
      technical,
    };
  }
  if (m.includes("memory") || m.includes("out of memory")) {
    return {
      plain: "The package scripts used too much memory and were stopped.",
      technical,
    };
  }
  if (m.includes("[resource:")) {
    const hit = /\[resource:([a-z-]+)\]/i.exec(technical);
    const key = hit?.[1]?.toLowerCase() ?? "host-state";
    return {
      plain: RESOURCE_PLAIN[key] ?? `Resource limit reached (${key}).`,
      technical,
    };
  }
  if (m.includes("attempt to call") && (m.includes("nil") || m.includes("a nil value"))) {
    const name = technical.match(/global ['"]([^'"]+)['"]/i)?.[1]
      ?? technical.match(/field ['"]([^'"]+)['"]/i)?.[1];
    return {
      plain: name
        ? `The scripts tried to call something that is not available here: "${name}". The sealed room only exposes a small host API.`
        : "The scripts tried to call something that is not available in the sealed room.",
      technical,
    };
  }
  if (m.includes("attempt to index") && m.includes("nil")) {
    return {
      plain: "The scripts looked up a field on a missing value (nil). A variable or table was not set first.",
      technical,
    };
  }
  if (m.includes("undefined") || m.includes("nil value") || m.includes("a nil value")) {
    const varHit = technical.match(/['"]([a-zA-Z_][\w]*)['"]/);
    return {
      plain: varHit
        ? `Something was missing or empty (often variable "${varHit[1]}"). Check the variable board and seed values.`
        : "Something was missing or empty (nil). Check variables the scripts expect on the board.",
      technical,
    };
  }
  if (m.includes("syntax") || m.includes("unexpected symbol") || m.includes("'end' expected")) {
    return {
      plain: "There is a syntax error in the package scripts (missing end, quote, or similar).",
      technical,
    };
  }
  if (m.includes("is not available") || m.includes("denied") || m.includes("disabled")) {
    return {
      plain: "The scripts asked for a capability that is blocked in the sealed room (no network, files, or system).",
      technical,
    };
  }

  return {
    plain: "Package scripts hit an error in the sealed room. See the technical line if you need the exact detail.",
    technical,
  };
}
