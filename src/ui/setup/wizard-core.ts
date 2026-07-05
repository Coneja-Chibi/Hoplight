/**
 * Wizard core - the pure logic under the first-run wizard (selection, defaults, progress, the
 * summary sentence plan). No DOM, no fetch: everything here is directly unit-tested, and the
 * wizard shell in wizard.ts stays a thin renderer over these functions.
 */
import type { SetupOption, SetupStepManifest, SummaryFragment } from "./step-contract";

/** The value an option writes into the draft/settings. */
export const optionValue = (opt: SetupOption): unknown => opt.value ?? opt.id;

/** The step's default draft value: multis default to [] (the "not sure yet" stance) unless a
 * non-clearing option is marked default; singles take the marked default, else the first option. */
export function defaultValue(manifest: SetupStepManifest, options: SetupOption[]): unknown {
  if (manifest.multi) {
    const marked = options.filter((o) => o.isDefault && !o.clears);
    return marked.map(optionValue);
  }
  const single = options.find((o) => o.isDefault) ?? options[0];
  return single ? optionValue(single) : undefined;
}

/** Is this option pressed for the current draft value? */
export function isPressed(opt: SetupOption, draftValue: unknown, multi: boolean | undefined): boolean {
  const v = optionValue(opt);
  if (!multi) return draftValue === v;
  const list = Array.isArray(draftValue) ? draftValue : [];
  return opt.clears ? list.length === 0 : list.includes(v);
}

/** Next multi-select state after pressing `opt`: clears-options reset the group; removing the
 * last real pick falls back to empty (the clears stance re-presses itself by absence). */
export function nextMultiSelection(current: unknown, opt: SetupOption): unknown[] {
  if (opt.clears) return [];
  const list = Array.isArray(current) ? [...current] : [];
  const v = optionValue(opt);
  const at = list.indexOf(v);
  if (at >= 0) list.splice(at, 1);
  else list.push(v);
  return list;
}

/** "2 of 4" - derived from the step list, never hand-numbered. */
export const progressLabel = (index: number, total: number): string => `${index + 1} of ${total}`;

/**
 * Assemble the summary-sentence plan: skip nulls, capitalize the sentence start, separate with
 * ", ", close with ".". Returns render-ready fragments (the wizard bolds each `strong`).
 */
export function sentencePlan(fragments: (SummaryFragment | null)[]): SummaryFragment[] {
  const real = fragments.filter((f): f is SummaryFragment => f !== null);
  return real.map((f, i) => {
    const pre = i === 0 ? capitalize(f.pre ?? "") : `, ${f.pre ?? ""}`;
    const post = i === real.length - 1 ? `${f.post ?? ""}.` : (f.post ?? "");
    const strong = i === 0 && !f.pre ? capitalize(f.strong) : f.strong;
    return { pre, strong, post };
  });
}

const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
