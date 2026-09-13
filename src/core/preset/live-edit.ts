/**
 * The edit rules for the resolved live preview: pure functions from (block content, segment,
 * edit) to new block content, kept out of the React layer so they are provable without a DOM
 * (simulated typing never reaches onChange in this suite - the rules live here instead).
 *
 * Every splice is guarded by a staleness check: the segment's expected text must still sit at
 * [sourceStart, sourceEnd) in the content being edited. If the block changed under the preview,
 * the edit returns null instead of splicing into the wrong characters - a refused edit is
 * recoverable, a silently corrupted block is not.
 */
import type { LiteralSegment, MacroSegment, RenderSegment } from "../macros";

const expectedText = (seg: RenderSegment): string =>
  seg.kind === "literal" ? seg.value : seg.raw;

/** Does this segment still describe this content? False means the preview is stale. */
export function segmentIsCurrent(content: string, seg: RenderSegment): boolean {
  return (
    seg.sourceStart >= 0 &&
    seg.sourceEnd >= seg.sourceStart &&
    seg.sourceEnd <= content.length &&
    content.slice(seg.sourceStart, seg.sourceEnd) === expectedText(seg)
  );
}

/**
 * Replace a segment's authored range with new text. Works for a literal edit (the everyday case)
 * and for replacing a whole macro expression. Null when the segment no longer matches.
 */
export function spliceSegment(content: string, seg: RenderSegment, newText: string): string | null {
  if (!segmentIsCurrent(content, seg)) return null;
  return content.slice(0, seg.sourceStart) + newText + content.slice(seg.sourceEnd);
}

/**
 * Rewrite ONE option inside a choice macro's authored expression (`random`/`pick`), keeping the
 * other branches. Handles both authored spellings: `::`-separated args and the one-arg
 * comma-separated habit. Refuses (null) when the expression nests macros (a nested `{{ }}` makes
 * textual arg surgery unsafe) or when the option list no longer matches the segment's detail.
 */
export function editChoiceOption(
  seg: MacroSegment,
  optionIndex: number,
  newOption: string,
): string | null {
  if (seg.detail?.kind !== "choice") return null;
  const { options } = seg.detail;
  if (optionIndex < 0 || optionIndex >= options.length) return null;
  if (!seg.raw.startsWith("{{") || !seg.raw.endsWith("}}")) return null;
  const inner = seg.raw.slice(2, -2);
  if (inner.includes("{{")) return null;

  if (inner.includes("::")) {
    const parts = inner.split("::");
    // parts[0] is the macro name; options are parts[1..]
    if (parts.length - 1 === options.length) {
      if (parts[optionIndex + 1]?.trim() !== options[optionIndex]) return null;
      parts[optionIndex + 1] = newOption;
      return `{{${parts.join("::")}}}`;
    }
    // one `::` arg carrying a comma list: {{random::a,b,c}}
    if (parts.length === 2 && options.length > 1) {
      const pieces = (parts[1] ?? "").split(",");
      if (pieces.length !== options.length) return null;
      if (pieces[optionIndex]?.trim() !== options[optionIndex]) return null;
      pieces[optionIndex] = newOption;
      return `{{${parts[0]}::${pieces.join(",")}}}`;
    }
    return null;
  }

  // comma form: {{random::a,b}} never reaches here ("::" branch above); this is {{random:...}}
  // already normalized away, so the remaining authored shape is a single comma list after the name
  const colon = inner.indexOf(":");
  const name = colon === -1 ? inner : inner.slice(0, colon);
  const list = colon === -1 ? "" : inner.slice(colon + 1);
  const pieces = list.split(",");
  if (pieces.length !== options.length) return null;
  if (pieces[optionIndex]?.trim() !== options[optionIndex]) return null;
  pieces[optionIndex] = newOption;
  return `{{${name}:${pieces.join(",")}}}`;
}

/** A literal segment's editable text is exactly its authored slice. */
export const literalEditText = (seg: LiteralSegment): string => seg.value;
