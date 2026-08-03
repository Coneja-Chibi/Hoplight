/**
 * Is this preset internally coherent, regardless of whether its macros resolve?
 *
 * A DIFFERENT QUESTION FROM preset_verify, and a harder one. That tool asks the target engine to
 * assemble the file and reports what did not expand. It cannot see a block that is enabled, expands
 * perfectly, and is ordered after the thing that was supposed to read it. The macros resolve; the
 * module simply is not in the prompt. Nothing in the output looks wrong.
 *
 * The survey of 22 community presets found exactly one author who had built a check for this class of
 * defect by hand, against four other mechanisms carrying the same hazard with no detection at all. So
 * these rules are not theoretical tidiness: they are the failures that corpus actually contains.
 *
 * PURE AND ADVISORY. No engine, no process, no filesystem. Every finding names the blocks involved, so
 * a reader can disagree with it. This reports; it never rewrites.
 */
import { findPattern, type BlockPattern } from "./patterns";

/** A block as this checker needs to see it: identity, whether it runs, and what pattern it is. */
export interface ClassifiedBlock {
  readonly identifier: string;
  readonly name?: string;
  readonly enabled: boolean;
  /** The pattern id from the catalog. Absent when nothing recognised it, which is not a fault. */
  readonly pattern?: string;
}

export type FindingKind =
  /** A block is ordered before something it depends on. */
  | "out-of-order"
  /** A block depends on a pattern that is not present or not enabled. */
  | "missing-dependency"
  /** More than one member of an exclusive group is enabled. */
  | "ambiguous-choice";

export interface CoherenceFinding {
  readonly kind: FindingKind;
  /** The block the finding is about. */
  readonly identifier: string;
  /** One sentence naming the consequence, not just the rule. */
  readonly detail: string;
}

const label = (block: ClassifiedBlock): string => block.name ?? block.identifier;

/**
 * Check the ordering rules the catalog declares.
 *
 * Only ENABLED blocks are considered. A disabled block that would be out of order is not a problem
 * anybody has, and reporting it would bury the real findings under noise from every option a person
 * has ever turned off.
 */
export function checkCoherence(blocks: readonly ClassifiedBlock[]): CoherenceFinding[] {
  const findings: CoherenceFinding[] = [];
  const live = blocks.filter((block) => block.enabled && block.pattern);

  /** First index at which each pattern appears, since a later duplicate cannot repair an early read. */
  const firstIndex = new Map<string, number>();
  live.forEach((block, index) => {
    if (!firstIndex.has(block.pattern!)) firstIndex.set(block.pattern!, index);
  });

  live.forEach((block, index) => {
    const pattern = findPattern(block.pattern!);
    if (!pattern?.ordering) return;
    reportOrdering(pattern, block, index, firstIndex, findings);
  });

  findings.push(...checkExclusive(live));
  return findings;
}

function reportOrdering(
  pattern: BlockPattern,
  block: ClassifiedBlock,
  index: number,
  firstIndex: Map<string, number>,
  findings: CoherenceFinding[],
): void {
  const ordering = pattern.ordering!;

  // Absent dependencies are collected into ONE finding. A block with three unmet requirements is one
  // problem a person fixes once, and three lines saying nearly the same thing buries the rest.
  const absent: string[] = [];
  for (const required of ordering.requires ?? []) {
    if (!firstIndex.has(required)) {
      absent.push(findPattern(required)?.name.toLowerCase() ?? required);
    }
  }

  // `after` is ordering only: it constrains position when the other pattern is present, and a preset
  // that simply has no option blocks is not broken.
  for (const required of ordering.after ?? []) {
    const at = firstIndex.get(required);
    if (at !== undefined && at > index) {
      findings.push({
        kind: "out-of-order",
        identifier: block.identifier,
        detail: `${label(block)} runs before the ${findPattern(required)?.name.toLowerCase() ?? required}`
          + ` it depends on. ${ordering.because}`,
      });
    }
  }

  if (absent.length > 0) {
    findings.push({
      kind: "missing-dependency",
      identifier: block.identifier,
      detail: `${label(block)} is a ${pattern.name.toLowerCase()} and nothing enabled here is a`
        + ` ${absent.join(" or a ")}. ${ordering.because}`,
    });
  }

  for (const later of ordering.before ?? []) {
    const at = firstIndex.get(later);
    if (at !== undefined && at < index) {
      findings.push({
        kind: "out-of-order",
        identifier: block.identifier,
        detail: `${label(block)} runs after the ${findPattern(later)?.name.toLowerCase() ?? later}`
          + ` that needed it first. ${ordering.because}`,
      });
    }
  }
}

/**
 * Two members of an exclusive group enabled at once.
 *
 * Reported without asserting which wins, because that genuinely depends on the preset's family:
 * first-enabled-wins where members guard on an unset flag, last-write-wins where they all write the
 * same variable. No surveyed preset declares which it is, so guessing here would be worse than
 * naming the ambiguity.
 */
function checkExclusive(live: readonly ClassifiedBlock[]): CoherenceFinding[] {
  const members = live.filter((block) => block.pattern === "option-exclusive");
  if (members.length < 2) return [];
  const names = members.map(label).join(", ");
  return members.slice(1).map((block) => ({
    kind: "ambiguous-choice" as const,
    identifier: block.identifier,
    detail: `More than one exclusive option is enabled (${names}). Which one takes effect depends on`
      + " whether this preset resolves by first-enabled or by last-write, and nothing in the file says.",
  }));
}

/** The findings as a readable summary. Markdown, so a transcript renders it like any other reply. */
export function formatCoherence(findings: readonly CoherenceFinding[]): string {
  if (findings.length === 0) {
    return "**Preset coherence**\n\nNo ordering or dependency problems found. This does not check"
      + " whether macros resolve; `preset_verify` answers that.";
  }
  const lines = ["**Preset coherence**", "", `${findings.length} finding(s):`, ""];
  for (const finding of findings) {
    lines.push(`- \`${finding.identifier}\` (${finding.kind}): ${finding.detail}`);
  }
  lines.push("");
  lines.push("Every one of these renders as a complete, plausible preset, which is why they are worth"
    + " naming rather than leaving to be noticed.");
  return lines.join("\n");
}
