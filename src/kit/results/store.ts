/**
 * Bounded session-local storage for oversized tool observations. Handles are opaque counters and
 * never contain a path, tool argument, or user-authored label.
 */

export interface ResultStoreOptions {
  inlineChars?: number;
  maxEntryBytes?: number;
  maxEntries?: number;
  maxTotalBytes?: number;
}

export interface ResultStat {
  handle: string;
  label: string;
  totalChars: number;
  totalBytes: number;
  totalLines: number;
}

export interface ResultRead {
  handle: string;
  content: string;
  offset: number;
  limit: number;
  totalChars: number;
  nextOffset: number | null;
}

export interface ResultSearch {
  handle: string;
  query: string;
  matches: readonly { line: number; text: string }[];
  totalMatches: number;
}

export type CapturedResult =
  | {
      spilled: false;
      content: string;
      totalChars: number;
      totalBytes: number;
      totalLines: number;
    }
  | {
      spilled: true;
      handle: string;
      peek: string;
      totalChars: number;
      totalBytes: number;
      totalLines: number;
    };

export interface ResultStore {
  capture(label: string, content: string): CapturedResult;
  stat(handle: string): ResultStat | null;
  read(handle: string, options?: { offset?: number; limit?: number }): ResultRead | null;
  search(
    handle: string,
    options: { query: string; offset?: number; limit?: number },
  ): ResultSearch | null;
}

interface StoredResult extends ResultStat {
  content: string;
}

const DEFAULT_INLINE_CHARS = 4_096;
const DEFAULT_MAX_ENTRY_BYTES = 1_000_000;
const DEFAULT_MAX_ENTRIES = 24;
const DEFAULT_MAX_TOTAL_BYTES = 4_000_000;
/**
 * The largest page a reader may ask for.
 *
 * MEASURED AGAINST REAL PRESETS RATHER THAN CHOSEN. At 12,000 this was four round trips per 50KB,
 * and the studio it was written for has a MEDIAN preset of 440KB - so an ordinary "read this preset"
 * cost thirty-odd tool calls, against a per-turn budget of forty-eight. The agent was spending its
 * whole turn turning pages, and the person watching saw a minute of "consulting" for one file.
 *
 * 48,000 chars is roughly 13k tokens: still a fraction of any modern window, and a quarter of the
 * round trips. The spill itself stays - a 440KB entity must NOT arrive whole, whatever the window,
 * because one tool result should never be able to crowd out the conversation that asked for it.
 */
const MAX_READ_CHARS = 48_000;
const MAX_SEARCH_ROWS = 50;
const MAX_SEARCH_LINE_CHARS = 500;

const lineCount = (content: string): number =>
  content.length === 0 ? 0 : content.split(/\r?\n/).length;
const byteCount = (content: string): number => new TextEncoder().encode(content).byteLength;

const positive = (value: number | undefined, fallback: number): number =>
  Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : fallback;

/** Create one isolated result store. Discarding its owning Kit session discards every result. */
export function createResultStore(options: ResultStoreOptions = {}): ResultStore {
  const inlineChars = positive(options.inlineChars, DEFAULT_INLINE_CHARS);
  const maxEntryBytes = positive(options.maxEntryBytes, DEFAULT_MAX_ENTRY_BYTES);
  const maxEntries = positive(options.maxEntries, DEFAULT_MAX_ENTRIES);
  const maxTotalBytes = positive(options.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES);
  const entries = new Map<string, StoredResult>();
  let sequence = 0;
  let totalBytes = 0;

  const evictOldest = (): void => {
    const oldest = entries.keys().next().value as string | undefined;
    if (!oldest) return;
    totalBytes -= entries.get(oldest)?.totalBytes ?? 0;
    entries.delete(oldest);
  };

  return {
    capture(label, content) {
      const totalLines = lineCount(content);
      const contentBytes = byteCount(content);
      if (content.length <= inlineChars) {
        return {
          spilled: false,
          content,
          totalChars: content.length,
          totalBytes: contentBytes,
          totalLines,
        };
      }
      if (contentBytes > maxEntryBytes || contentBytes > maxTotalBytes) {
        throw new Error(
          `result exceeds bounded store (${contentBytes} bytes; max ${Math.min(
            maxEntryBytes,
            maxTotalBytes,
          )} bytes)`,
        );
      }
      while (entries.size >= maxEntries || totalBytes + contentBytes > maxTotalBytes) {
        evictOldest();
      }
      const handle = `result-${++sequence}`;
      const stored: StoredResult = {
        handle,
        label,
        content,
        totalChars: content.length,
        totalBytes: contentBytes,
        totalLines,
      };
      entries.set(handle, stored);
      totalBytes += contentBytes;
      return {
        spilled: true,
        handle,
        peek: content.slice(0, inlineChars),
        totalChars: content.length,
        totalBytes: contentBytes,
        totalLines,
      };
    },

    stat(handle) {
      const stored = entries.get(handle);
      if (!stored) return null;
      const { content: _content, ...stat } = stored;
      return stat;
    },

    read(handle, options = {}) {
      const stored = entries.get(handle);
      if (!stored) return null;
      const offset = Math.max(0, Math.min(stored.totalChars, options.offset ?? 0));
      const limit = Math.max(1, Math.min(MAX_READ_CHARS, options.limit ?? DEFAULT_INLINE_CHARS));
      const content = stored.content.slice(offset, offset + limit);
      const end = offset + content.length;
      return {
        handle,
        content,
        offset,
        limit,
        totalChars: stored.totalChars,
        nextOffset: end < stored.totalChars ? end : null,
      };
    },

    search(handle, options) {
      const stored = entries.get(handle);
      if (!stored) return null;
      const query = options.query.trim().toLowerCase();
      const offset = Math.max(0, options.offset ?? 0);
      const limit = Math.max(1, Math.min(MAX_SEARCH_ROWS, options.limit ?? 12));
      if (!query) return { handle, query, matches: [], totalMatches: 0 };
      const matches = stored.content.split(/\r?\n/)
        .map((text, index) => ({ line: index + 1, text }))
        .filter((row) => row.text.toLowerCase().includes(query));
      return {
        handle,
        query: options.query,
        matches: matches.slice(offset, offset + limit).map((row) => ({
          line: row.line,
          text: row.text.slice(0, MAX_SEARCH_LINE_CHARS),
        })),
        totalMatches: matches.length,
      };
    },
  };
}
