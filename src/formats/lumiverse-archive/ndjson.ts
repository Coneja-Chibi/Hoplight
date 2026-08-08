/**
 * Streaming NDJSON reader for database/{table}.ndjson (spec Behavior step 3). One raw SQLite row
 * per line, column names as keys.
 *
 * Streaming rather than buffering is a requirement, not an optimization: the real export inspected
 * while drafting the spec held 22,770 world book entry rows in one file, and edge case 9 says the
 * join buffer must stream per book rather than load the table.
 *
 * Line ceilings mirror Lumiverse's own reader: 4 MiB once ndjsonFormatVersion promises it, 64 MiB
 * on legacy archives that make no promise. A line past the ceiling is a per-row failure, not a
 * table or archive abort, so the reader discards to the next newline and keeps going. That matches
 * the per-row isolation the rest of the format is built on (spec Behavior step 7).
 */
const NEWLINE = 0x0a;

/** Ceiling an archive earns by declaring ndjsonFormatVersion >= 1. */
export const MAX_NDJSON_LINE_BYTES = 4 * 1024 * 1024;
/** Ceiling for legacy archives where the field is absent and no promise was made. */
export const LEGACY_MAX_NDJSON_LINE_BYTES = 64 * 1024 * 1024;

export const ndjsonLineCeiling = (ndjsonFormatVersion?: number): number =>
  ndjsonFormatVersion !== undefined && ndjsonFormatVersion >= 1
    ? MAX_NDJSON_LINE_BYTES
    : LEGACY_MAX_NDJSON_LINE_BYTES;

export interface NdjsonLineFailure {
  /** 1-based line number inside the entry. */
  line: number;
  reason: string;
}

export interface NdjsonReadOptions {
  maxLineBytes: number;
  onFailure?: (failure: NdjsonLineFailure) => void;
}

export interface NdjsonRow {
  line: number;
  row: Record<string, unknown>;
}

const decoder = new TextDecoder();

const concat = (parts: readonly Uint8Array[], total: number): Uint8Array => {
  if (parts.length === 1) return parts[0]!;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
};

/** Blank lines are not rows and not errors. Anything else must decode to a JSON object. */
function parseLine(bytes: Uint8Array, line: number, options: NdjsonReadOptions): NdjsonRow | null {
  const text = decoder.decode(bytes).trim();
  if (text === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    options.onFailure?.({ line, reason: `unparseable JSON (${(error as Error).message})` });
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    options.onFailure?.({ line, reason: "line is not a JSON object" });
    return null;
  }
  return { line, row: parsed as Record<string, unknown> };
}

/**
 * Yield one row per line. The generator holds at most one line in memory, plus whatever chunk the
 * source just handed over.
 */
export async function* readNdjson(
  stream: ReadableStream<Uint8Array>,
  options: NdjsonReadOptions,
): AsyncGenerator<NdjsonRow> {
  const reader = stream.getReader();
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  /** The current line already blew the ceiling: drop bytes until the newline that ends it. */
  let dropping = false;
  let line = 0;

  const reset = (): void => {
    pending = [];
    pendingBytes = 0;
  };

  const overflow = (): void => {
    line += 1;
    options.onFailure?.({
      line,
      reason: `line exceeds the ${options.maxLineBytes} byte ceiling`,
    });
    dropping = false;
    reset();
  };

  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      let chunk = step.value;

      for (;;) {
        const at = chunk.indexOf(NEWLINE);
        if (at === -1) {
          if (!dropping) {
            pending.push(chunk);
            pendingBytes += chunk.byteLength;
            if (pendingBytes > options.maxLineBytes) {
              dropping = true;
              reset();
            }
          }
          break;
        }

        const head = chunk.subarray(0, at);
        chunk = chunk.subarray(at + 1);

        if (dropping) {
          overflow();
          continue;
        }
        pending.push(head);
        pendingBytes += head.byteLength;
        if (pendingBytes > options.maxLineBytes) {
          overflow(); // the line ended here, so report it now rather than dropping further
          continue;
        }

        const bytes = concat(pending, pendingBytes);
        reset();
        line += 1;
        const parsed = parseLine(bytes, line, options);
        if (parsed) yield parsed;
      }
    }

    // A final line with no trailing newline is still a line.
    if (dropping) overflow();
    else if (pendingBytes > 0) {
      const bytes = concat(pending, pendingBytes);
      reset();
      line += 1;
      const parsed = parseLine(bytes, line, options);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}
