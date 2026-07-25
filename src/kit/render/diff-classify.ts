/**
 * Pure unified-diff recognition for fenced transcript code. Explicit diff/patch fences always opt in;
 * other fences need a hunk header plus changed lines so ordinary arithmetic is not painted as a patch.
 */
export type DiffLineKind = "meta" | "add" | "remove" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffPlaybill {
  additions: number;
  removals: number;
  lines: DiffLine[];
}

const EXPLICIT_DIFF = /^(?:diff|patch|udiff)$/i;

const kindOf = (line: string): DiffLineKind => {
  if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ")) return "meta";
  if (line.startsWith("+++") || line.startsWith("---")) return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "remove";
  return "context";
};

export const classifyDiff = (
  lines: readonly string[],
  language?: string,
): DiffPlaybill | null => {
  const explicit = EXPLICIT_DIFF.test(language?.trim() ?? "");
  const hasHunk = lines.some((line) => line.startsWith("@@"));
  const hasAdd = lines.some((line) => line.startsWith("+") && !line.startsWith("+++"));
  const hasRemove = lines.some((line) => line.startsWith("-") && !line.startsWith("---"));
  if (!explicit && !(hasHunk && hasAdd && hasRemove)) return null;

  const classified = lines.map((text) => ({ kind: kindOf(text), text }));
  return {
    additions: classified.filter((line) => line.kind === "add").length,
    removals: classified.filter((line) => line.kind === "remove").length,
    lines: classified,
  };
};
