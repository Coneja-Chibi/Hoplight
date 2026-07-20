/**
 * Pure doctrine checks shared by the repository scanner and its tests. Keeping detection separate
 * from filesystem traversal makes the policy deterministic and regression-testable.
 */

const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/** Source files begin with a documentation block that explains why the file exists. */
export function hasOpeningDocblock(source: string): boolean {
  const text = source.replace(/^\uFEFF/, "");
  const afterShebang = text.startsWith("#!") ? text.slice(text.indexOf("\n") + 1) : text;
  return afterShebang.startsWith("/**");
}

/** True when authored prose or source contains an emoji-style pictograph. */
export function containsEmoji(source: string): boolean {
  return EXTENDED_PICTOGRAPHIC.test(source);
}
