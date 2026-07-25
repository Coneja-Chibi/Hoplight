/**
 * User-visible text boundaries for Kit. JavaScript slices UTF-16 code units, which can tear emoji,
 * combining marks, flags, and ZWJ sequences. These helpers keep display truncation and backspace on
 * complete grapheme clusters through the platform's Unicode segmenter.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export const splitGraphemes = (text: string): string[] =>
  Array.from(segmenter.segment(text), (part) => part.segment);

export const truncateGraphemes = (text: string, cap: number): string => {
  const parts = splitGraphemes(text);
  return parts.length > cap ? `${parts.slice(0, cap).join("").trimEnd()}…` : text;
};

export const dropLastGrapheme = (text: string): string => {
  const parts = splitGraphemes(text);
  parts.pop();
  return parts.join("");
};

export const tailGraphemes = (text: string, cap: number): string => {
  const parts = splitGraphemes(text);
  return parts.length > cap ? parts.slice(-cap).join("") : text;
};
