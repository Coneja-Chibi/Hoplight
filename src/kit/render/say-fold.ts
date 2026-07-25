/**
 * Deterministic long-reply folding policy. It depends only on stored text, so a resumed transcript
 * produces the same collapsed shape as the live session after streaming settles.
 */
export const LONG_SAY_CHARS = 1200;

export const isLongSay = (text: string): boolean => text.length > LONG_SAY_CHARS;
