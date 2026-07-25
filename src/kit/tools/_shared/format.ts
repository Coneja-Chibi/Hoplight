/**
 * Formatting helpers shared by the read tools: turn engine objects into the text a model observes.
 * Output is always bounded, a tool must never hand the model an unbounded blob.
 */
import type { EntitySummary } from "../../bridge";

/** One list row: "kind/id  name  (source)". */
export const summaryLine = (summary: EntitySummary): string => {
  const source = summary.sourceFormat ? `  (${summary.sourceFormat})` : "";
  return `${summary.kind}/${summary.id}  ${summary.name}${source}`;
};
