/**
 * paste-classify: decide whether a paste flows inline (the common small case, left to the native
 * buffer) or becomes a held "card" (big/multi-line, shown above the composer and spliced in at submit).
 * Pure core, no I/O. Bounded and tolerant per the reliability rules: caps bytes from a single paste and
 * truncates with a visible marker rather than accepting unbounded untrusted input; never throws.
 */

export interface PasteCard {
  readonly preview: string;
  readonly lineCount: number;
  readonly byteLength: number;
  readonly truncated: boolean;
  readonly text: string;
}

export type Classified = { kind: "inline" } | ({ kind: "card" } & PasteCard);

const MAX_PASTE_BYTES = 200_000; // cap untrusted clipboard input
const CARD_LINES = 4; // more lines than this becomes a card
const CARD_BYTES = 400; // or more bytes than this

const byteLen = (s: string): number => new TextEncoder().encode(s).length;

/** Longest prefix that fits the UTF-8 byte budget, without splitting a surrogate pair. */
const byteBoundedPrefix = (text: string, maxBytes: number): string => {
  let bytes = 0;
  let end = 0;
  while (end < text.length) {
    const point = text.codePointAt(end)!;
    const pointBytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + pointBytes > maxBytes) break;
    bytes += pointBytes;
    end += point > 0xffff ? 2 : 1;
  }
  return text.slice(0, end);
};

/** Classify a decoded paste. Small single-shot text stays inline; anything larger becomes a card. */
export const classifyPaste = (text: string): Classified => {
  const rawBytes = byteLen(text);
  const truncated = rawBytes > MAX_PASTE_BYTES;
  const kept = truncated ? byteBoundedPrefix(text, MAX_PASTE_BYTES) : text;
  const keptBytes = truncated ? byteLen(kept) : rawBytes;
  const lineCount = kept.length === 0 ? 0 : kept.split("\n").length;
  if (!truncated && lineCount <= CARD_LINES && rawBytes <= CARD_BYTES) return { kind: "inline" };
  const size = truncated ? `${lineCount}+ lines, truncated` : `${lineCount} line${lineCount === 1 ? "" : "s"}`;
  return { kind: "card", preview: `pasted text · ${size}`, lineCount, byteLength: keptBytes, truncated, text: kept };
};

const MAX_CARDS = 5; // bounded: only so many pending cards ride along

/** Splice the draft and any pending cards into one message at submit time. */
export const buildSubmission = (draft: string, cards: readonly PasteCard[]): string =>
  [draft, ...cards.slice(0, MAX_CARDS).map((c) => c.text)].filter((part) => part.length > 0).join("\n\n");
